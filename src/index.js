import { Application, app } from './core/Application.js';
import { Router, router } from './core/Router.js';

export { Application, app, Router, router };

export default {
  async fetch(request, env) {
    return app.fetch(request, env);
  }
};
