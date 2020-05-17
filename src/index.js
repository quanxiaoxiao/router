const fp = require('lodash/fp');
const { pathToRegexp } = require('path-to-regexp');
const apiParser = require('@quanxiaoxiao/api-parser');
const routeHandler = require('@quanxiaoxiao/route-handler');


module.exports = (api, logger) => {
  const routeList = apiParser(api)
    .map((item) => ({
      ...item,
      regexp: pathToRegexp(item.pathname),
    }));

  if (logger && logger.info) {
    logger.info('---------routerList---------');
    logger.info(routeList.map((item) => `${item.method} ${item.pathname}`).join('\n'));
    logger.info('---------routerList---------');
  }

  return async (ctx, next) => {
    const { path, method, ip } = ctx;
    if (ctx.logger && ctx.logger.info) {
      ctx.logger.info(`${ip} -> [${method}] ${path}`);
    }
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
          return;
        }
        ctx.throw(405);
      }
      ctx.throw(404);
    }
    const handleName = fp.compose(
      fp.first,
      fp.filter((key) => !['method', 'pathname', 'regexp'].includes(key)),
      fp.keys,
    )(routerItem);
    if (!handleName) {
      if (ctx.logger && ctx.logger.error) {
        ctx.logger.error(`[${method}] ${path} @:${routerItem.pathname}`);
      }
      ctx.throw(500);
    }
    const handler = routeHandler[handleName];
    if (!handler) {
      if (ctx.logger && ctx.logger.error) {
        ctx.logger.error(`[${method}] ${path} @:${routerItem.pathname} ::${handleName}`);
      }
      ctx.throw(500);
    }
    if (ctx.logger && ctx.logger.info) {
      ctx.logger.info(`[${method}] ${path} @:${routerItem.pathname} ::${handleName} `);
    }
    ctx.matchs = routerItem.regexp.exec(ctx.path);
    await handler(routerItem[handleName])(ctx, next);
  };
};
