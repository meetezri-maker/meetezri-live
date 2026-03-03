import { FastifyInstance } from "fastify";
import { upsertSettingHandler, getSettingHandler, getAllSettingsHandler } from "./system-settings.controller";
import { upsertSettingSchema, getSettingSchema } from "./system-settings.schema";

export async function systemSettingsRoutes(app: FastifyInstance) {
  // Debug logging for authentication middleware
  if (!app.authenticate) {
    app.log.error("CRITICAL: app.authenticate is undefined in systemSettingsRoutes. Auth plugin may not be loaded correctly.");
  } else {
    app.log.info("systemSettingsRoutes: app.authenticate is available.");
  }

  // Debug logging for authorization middleware
  if (!app.authorize) {
    app.log.error("CRITICAL: app.authorize is undefined in systemSettingsRoutes.");
  }

  app.get(
    "/",
    {
      // Ensure authenticate is defined before passing to onRequest
      onRequest: app.authenticate ? [app.authenticate] : [],
    },
    getAllSettingsHandler
  );

  app.get(
    "/:key",
    {
      schema: {
        params: getSettingSchema,
      },
      onRequest: app.authenticate ? [app.authenticate] : [],
    },
    getSettingHandler
  );

  app.post(
    "/",
    {
      // Ensure both middlewares are defined
      onRequest: [
        app.authenticate, 
        app.authorize ? app.authorize(["super_admin", "org_admin", "team_admin"]) : async () => {}
      ].filter(Boolean),
      schema: {
        body: upsertSettingSchema,
      },
    },
    upsertSettingHandler
  );
}
