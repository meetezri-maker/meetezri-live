import { FastifyInstance } from "fastify";
import { upsertSettingHandler, getSettingHandler, getAllSettingsHandler } from "./system-settings.controller";
import { upsertSettingSchema, getSettingSchema } from "./system-settings.schema";

export async function systemSettingsRoutes(app: FastifyInstance) {
  // Fail fast instead of failing open when auth decorators are unavailable.
  if (!app.authenticate || !app.authorize) {
    throw new Error("Authentication/authorization decorators are not registered");
  }

  app.get(
    "/",
    {
      preHandler: [app.authenticate, app.authorize(["super_admin", "org_admin", "team_admin"])],
    },
    getAllSettingsHandler
  );

  app.get(
    "/:key",
    {
      schema: {
        params: getSettingSchema,
      },
      preHandler: [app.authenticate, app.authorize(["super_admin", "org_admin", "team_admin"])],
    },
    getSettingHandler
  );

  app.post(
    "/",
    {
      preHandler: [app.authenticate, app.authorize(["super_admin", "org_admin", "team_admin"])],
      schema: {
        body: upsertSettingSchema,
      },
    },
    upsertSettingHandler
  );
}
