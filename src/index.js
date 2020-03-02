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
    const { path, method } = ctx;
    const routerItem = routeList
      .find((item) => item.regexp.exec(path) && item.method === method);
    if (!routerItem) {
      if (routeList.some((item) => item.regexp.exec(path))) {
        ctx.throw(405);
      }
      ctx.throw(404);
    }
    if (ctx.logger && ctx.logger.info) {
      ctx.logger.info(`[${method}] ${path} match: ${routerItem.pathname}`);
    }
    const handleName = fp.compose(
      fp.first,
      fp.filter((key) => !['method', 'pathname', 'regexp'].includes(key)),
      fp.keys,
    )(routerItem);
    if (!handleName) {
      if (ctx.logger && ctx.logger.error) {
        ctx.logger.error(`pathname: ${routerItem.pathname}, cant handle`);
      }
      ctx.throw(500);
    }
    const handler = routeHandler[handleName];
    if (!handler) {
      if (ctx.logger && ctx.logger.error) {
        ctx.logger.error(`pathname: ${routerItem.pathname}, cant handle by ${handleName}`);
      }
      ctx.throw(500);
    }
    ctx.matchs = routerItem.regexp.exec(ctx.path);
    await handler(routerItem[handleName])(ctx, next);
  };
};
