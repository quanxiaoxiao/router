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
    logger.info(routeList.map((item) => `${item.pathname} \`${item.method}\``).join('\n'));
    logger.info('---------routerList---------');
  }

  return async (ctx, next) => {
    const { path, method, ip } = ctx;
    if (ctx.logger && ctx.logger.info) {
      ctx.logger.info(`${ip} -> ${path} \`${method}\``);
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
        ctx.logger.error(`${path} \`${method}\` [[${routerItem.pathname}]] handler is not exist`);
      }
      ctx.throw(500);
    }
    const handler = routeHandler[handleName];
    if (!handler) {
      if (ctx.logger && ctx.logger.error) {
        ctx.logger.error(`${path} \`${method}\` [[${routerItem.pathname}]] handler @${handleName} is not register`);
      }
      ctx.throw(500);
    }
    if (ctx.logger && ctx.logger.info) {
      ctx.logger.info(`${path} \`${method}\` [[${routerItem.pathname}]] @${handleName}`);
    }
    ctx.matchs = routerItem.regexp.exec(ctx.path);
    await handler(routerItem[handleName])(ctx, next);
  };
};
