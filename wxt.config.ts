import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  manifest: ({ browser }) => {
    const isFirefox = browser === "firefox";

    // Base permissions shared between browsers
    const basePermissions = [
      "storage",
      "tabs",
      "activeTab",
      "webNavigation",
      "alarms",
    ];

    // MV3 Chrome uses declarativeNetRequest + webNavigation for redirect
    // MV2 Firefox uses webRequest blocking (needs host permissions)
    const permissions = isFirefox
      ? [...basePermissions, "webRequest", "webRequestBlocking"]
      : [...basePermissions, "declarativeNetRequest"];

    // Only Firefox MV2 needs host permissions for webRequest
    const hostPermissions = isFirefox ? ["<all_urls>"] : [];

    return {
      name: "distracted",
      description:
        "blocks distracting websites! do mini tasks to get back on them...",
      permissions,
      host_permissions: hostPermissions,
      ...(isFirefox
        ? {
            browser_specific_settings: {
              gecko: {
                strict_min_version: "128.0",
                data_collection_permissions: {
                  required: ["none"],
                },
              },
            },
          }
        : {
            declarative_net_request: {
              rule_resources: [],
            },
          }),
    };
  },
  react: {
    vite: {
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    },
  },

  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }),
});
