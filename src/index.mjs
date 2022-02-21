import { pathToRegexp } from 'path-to-regexp';
import fp from 'lodash/fp.js';
import apiParser from '@quanxiaoxiao/api-parser';
import routeHandler from '@quanxiaoxiao/route-handler';

export default (api, logger) => {
  const routeList = apiParser(api)
    .map((item) => ({
      ...item,
      regexp: pathToRegexp(item.pathname),
    }));

  if (logger && logger.info) {
    logger.info('---------routerList---------');
    logger.info(routeList.map((item) => `${item.pathname} [${item.method}]`).join('\n'));
    logger.info('---------routerList---------');
  }

  return async (ctx, next) => {
    const { path, method } = ctx;
    const routerItem = routeList
      .find((item) => item.regexp.exec(path) && item.method === method);
    if (!routerItem) {
      const list = routeList.filter((item) => item.regexp.exec(path));
      if (list.length !== 0) {
        if (method === 'OPTIONS') {
          ctx.status = 204;
          ctx.set(
            'Access-Control-Allow-Methods',
            ['OPTIONS', ...list.map((item) => item.method)].join(','),
          );
          ctx.body = null;
        } else {
          ctx.throw(405);
        }
      } else {
        ctx.throw(404);
      }
    } else {
      const handleName = fp.compose(
        fp.first,
        fp.filter((key) => !['method', 'pathname', 'regexp'].includes(key)),
        fp.keys,
      )(routerItem);
      if (!handleName) {
        const errorMessage = `${path} [${method}] -> \`${routerItem.pathname}\`, handler is not exist`;
        if (ctx.logger && ctx.logger.error) {
          ctx.logger.error(errorMessage);
        } else {
          console.error(errorMessage);
        }
        ctx.throw(500);
      }
      const handler = routeHandler[handleName];
      if (!handler) {
        const errorMessage = `${path} [${method}] -> \`${routerItem.pathname}@${handleName}\`,  is not register`;
        if (ctx.logger && ctx.logger.error) {
          ctx.logger.error(errorMessage);
        } else {
          console.error(errorMessage);
        }
        ctx.throw(500);
      }
      ctx.matchs = routerItem.regexp.exec(path);
      if (ctx.logger && ctx.logger.info) {
        ctx.logger.info(`${path} [${method}] -> \`${routerItem.pathname}@${handleName}\``);
      }
      await handler(routerItem[handleName])(ctx, next);
    }
  };
};
