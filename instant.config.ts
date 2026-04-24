// instant.config.ts
import type { InstantConfig } from "@instantdb/core";
import schema from "./instant.schema";

const config: InstantConfig<typeof schema> = {
  appId: process.env.INSTANT_APP_ID!,
};

export default config;