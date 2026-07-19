import inquirer from "inquirer";

export async function promptForConfig(current) {
  return inquirer.prompt([
    {
      type: "input",
      name: "baseUrl",
      message: "Immich base URL:",
      default: current.baseUrl,
      when: !current.baseUrl,
    },
    {
      type: "password",
      name: "apiKey",
      message: "Immich API key:",
      mask: "*",
      when: !current.apiKey,
    },
    {
      type: "input",
      name: "defaultOutput",
      message: "Output directory:",
      default: current.defaultOutput,
    },
    {
      type: "number",
      name: "concurrency",
      message: "Concurrent downloads:",
      default: current.concurrency,
    },
    {
      type: "number",
      name: "maxRetries",
      message: "Max retries:",
      default: current.maxRetries,
    },
    {
      type: "confirm",
      name: "saveConfig",
      message: "Save config to .env?",
      default: true,
    },
  ]);
}
