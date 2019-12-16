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
    const routerItem = routeList
      .find((item) => item.regexp.exec(ctx.path) && item.method === ctx.method);
    if (!routerItem) {
      ctx.throw(404);
    }
    const handleName = fp.compose(
      fp.first,
      fp.filter((key) => !['method', 'pathname', 'regexp'].includes(key)),
      fp.keys,
    )(routerItem);
    if (!handleName) {
      if (logger && logger.error) {
        logger.error(`pathname: ${routerItem.pathname}, cant handle`);
      }
      ctx.throw(500);
    }
    const handler = routeHandler[handleName];
    if (!handler) {
      if (logger && logger.error) {
        logger.error(`pathname: ${routerItem.pathname}, cant handle by ${handleName}`);
      }
      ctx.throw(500);
    }
    ctx.matchs = routerItem.regexp.exec(ctx.path);
    await handler(routerItem[handleName])(ctx, next);
  };
};
