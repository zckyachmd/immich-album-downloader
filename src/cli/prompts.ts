import inquirer from "inquirer";

const validateUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch (e) {
    return "Enter a valid URL";
  }
};

export async function promptForConfig(current) {
  return inquirer.prompt([
    {
      type: "input",
      name: "baseUrl",
      message: "Immich base URL:",
      default: current.baseUrl,
      when: !current.baseUrl,
      validate: validateUrl,
    },
    {
      type: "password",
      name: "apiKey",
      message: "Immich API key:",
      mask: "*",
      when: !current.apiKey,
      validate: (value) => (value && value.length >= 10 ? true : "API key is required"),
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
      validate: (value) => (value >= 1 && value <= 50 ? true : "Enter a number from 1 to 50"),
    },
    {
      type: "number",
      name: "maxRetries",
      message: "Max retries:",
      default: current.maxRetries,
      validate: (value) => (value >= 0 && value <= 10 ? true : "Enter a number from 0 to 10"),
    },
    {
      type: "confirm",
      name: "saveConfig",
      message: "Save config to .env?",
      default: true,
    },
  ]);
}
