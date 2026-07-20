import chalk from "chalk";
import inquirer from "inquirer";

// ============================================================================
// DESIGN SYSTEM - Colors & Indicators
// ============================================================================

const colors = {
  primary: (text: string) => chalk.cyan(text),
  success: (text: string) => chalk.green(text),
  warning: (text: string) => chalk.yellow(text),
  error: (text: string) => chalk.red(text),
  muted: (text: string) => chalk.gray(text),
  bold: (text: string) => chalk.bold(text),
  dim: (text: string) => chalk.dim(text),
};

const indicators = {
  success: colors.success("✓"),
  error: colors.error("✗"),
  question: colors.primary("?"),
  info: colors.primary("ℹ"),
  warning: colors.warning("!"),
  hint: "→",
};

// ============================================================================
// FIELD METADATA - Configuration Fields Definition
// ============================================================================

interface FieldConfig {
  label: string;
  section: string;
  sectionIndicator: "REQUIRED" | "OPTIONAL";
  help: string;
  cliFlag: string;
  hints: string[];
  example?: string;
}

const CONFIG_FIELDS: Record<string, FieldConfig> = {
  baseUrl: {
    label: "Immich server base URL",
    section: "Server Configuration",
    sectionIndicator: "REQUIRED",
    help: "Complete URL to your Immich server",
    cliFlag: "--base-url",
    hints: ["Format: https://immich.example.com", "No trailing slash"],
    example: "https://immich.example.com",
  },
  apiKey: {
    label: "Immich API key",
    section: "Server Configuration",
    sectionIndicator: "REQUIRED",
    help: "Find this in Immich Settings → Utilities → API Keys",
    cliFlag: "--api-key",
    hints: ["Minimum 10 characters", "Keep this secret"],
    example: "abcd1234567890",
  },
  defaultOutput: {
    label: "Download output directory",
    section: "Download Settings",
    sectionIndicator: "OPTIONAL",
    help: "Where to save downloaded files",
    cliFlag: "--output",
    hints: ["Relative or absolute path", "Directory will be created if needed"],
    example: "./downloads",
  },
  concurrency: {
    label: "Concurrent downloads",
    section: "Download Settings",
    sectionIndicator: "OPTIONAL",
    help: "How many files to download at the same time",
    cliFlag: "--concurrency",
    hints: ["Range: 1-50", "Recommended: 3-10 for stable connections"],
    example: "5",
  },
  maxRetries: {
    label: "Maximum retry attempts",
    section: "Download Settings",
    sectionIndicator: "OPTIONAL",
    help: "Retry failed downloads this many times",
    cliFlag: "--max-retries",
    hints: ["Range: 0-10", "Increase for unreliable networks"],
    example: "3",
  },
  saveConfig: {
    label: "Save configuration to .env",
    section: "Persistence",
    sectionIndicator: "OPTIONAL",
    help: "Save these settings for future runs",
    cliFlag: "--save-config",
    hints: ["Creates/updates .env file"],
  },
};

// ============================================================================
// VALIDATORS - Enhanced Validation with Professional Feedback
// ============================================================================

const validateUrl = (value: string): true | string => {
  if (!value) return `${indicators.error} URL is required`;

  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      return `${indicators.error} URL must use HTTP or HTTPS protocol`;
    }
    return true;
  } catch (e) {
    return `${indicators.error} Invalid URL format. Use: https://immich.example.com`;
  }
};

const validateApiKey = (value: string): true | string => {
  if (!value) return `${indicators.error} API key is required`;
  if (value.length < 10) {
    return `${indicators.error} API key too short: ${value.length} chars (minimum: 10)`;
  }
  return true;
};

const validateConcurrency = (value: number): true | string => {
  if (isNaN(value)) return `${indicators.error} Must be a number`;
  if (value < 1 || value > 50) {
    return `${indicators.error} Must be 1-50 (you entered: ${value})`;
  }
  return true;
};

const validateMaxRetries = (value: number): true | string => {
  if (isNaN(value)) return `${indicators.error} Must be a number`;
  if (value < 0 || value > 10) {
    return `${indicators.error} Must be 0-10 (you entered: ${value})`;
  }
  return true;
};

// ============================================================================
// UTILITIES - Helper Functions
// ============================================================================

function printHeader() {
  const width = 64;
  const title = "Immich Album Downloader - Configuration";
  const subtitle = "v1.x • Interactive Setup";

  console.log("");
  console.log(colors.bold(colors.primary("╔" + "═".repeat(width - 2) + "╗")));
  console.log(
    colors.primary("║") +
      colors.bold(title.padEnd(width - 2)) +
      colors.primary("║")
  );
  console.log(
    colors.primary("║") + subtitle.padEnd(width - 2) + colors.primary("║")
  );
  console.log(colors.bold(colors.primary("╚" + "═".repeat(width - 2) + "╝")));
  console.log("");

  const shortcuts =
    "Ctrl+C to cancel • Tab for next • Enter to confirm • ↑↓ for history";
  console.log(
    `${indicators.question} ${colors.muted(shortcuts)}`
  );
  console.log("");
}

function printSectionHeader(
  sectionName: string,
  indicator: "REQUIRED" | "OPTIONAL"
) {
  const indicatorColor =
    indicator === "REQUIRED" ? colors.error : colors.muted;
  const header = `${sectionName} ${indicatorColor(`[${indicator}]`)}`;
  console.log("");
  console.log(colors.bold(header));
  console.log(colors.muted("─".repeat(60)));
}

function getFieldPrompt(
  fieldKey: string,
  fieldConfig: FieldConfig,
  currentValue: any,
  type: "input" | "password" | "number" | "confirm" = "input"
) {
  const badge = `[${fieldConfig.sectionIndicator === "REQUIRED" ? colors.error("REQUIRED") : colors.muted("OPTIONAL")}]`;
  const message = `${badge} ${fieldConfig.label}`;

  const basePrompt: any = {
    name: fieldKey,
    message,
    default: currentValue,
    prefix: `  ${indicators.question}`,
  };

  switch (type) {
    case "password":
      return {
        ...basePrompt,
        type: "password",
        mask: "•",
        validate: validateApiKey,
      };

    case "number":
      return {
        ...basePrompt,
        type: "number",
        validate:
          fieldKey === "concurrency"
            ? validateConcurrency
            : validateMaxRetries,
      };

    case "confirm":
      return {
        ...basePrompt,
        type: "confirm",
      };

    default: // input
      return {
        ...basePrompt,
        type: "input",
        validate: fieldKey === "baseUrl" ? validateUrl : undefined,
        filter: (value: string) =>
          fieldKey === "baseUrl" ? value.trim() : value,
      };
  }
}

function getCliEquivalent(fieldKey: string, value: any): string {
  const field = CONFIG_FIELDS[fieldKey];
  if (fieldKey === "saveConfig") return "";

  const flagValue =
    typeof value === "string" ? `"${value}"` : String(value);
  return `${field.cliFlag} ${flagValue}`;
}

function printCliTip(fieldKey: string, currentValue: any) {
  if (fieldKey === "saveConfig") return;

  const field = CONFIG_FIELDS[fieldKey];
  const equivalentCommand = getCliEquivalent(fieldKey, currentValue);

  console.log(
    colors.muted(
      `  ${indicators.hint} Skip this: immich-album-downloader ${equivalentCommand}`
    )
  );
}

// ============================================================================
// MAIN EXPORT - Configuration Wizard
// ============================================================================

export async function promptForConfig(current: any) {
  printHeader();

  // Group fields by section, preserving CONFIG_FIELDS declaration order
  const fieldsBySection = Object.entries(CONFIG_FIELDS).reduce(
    (acc, [key, config]) => {
      if (!acc[config.section]) acc[config.section] = [];
      acc[config.section].push({ key, ...config });
      return acc;
    },
    {} as Record<string, any[]>
  );

  let answers: Record<string, any> = {};

  for (const [section, fields] of Object.entries(fieldsBySection)) {
    const sectionPrompts: any[] = [];

    for (const fieldConfig of fields) {
      const fieldKey = fieldConfig.key;
      const currentValue = current[fieldKey];
      const shouldPrompt =
        fieldKey === "saveConfig" ||
        fieldKey === "defaultOutput" ||
        fieldKey === "concurrency" ||
        fieldKey === "maxRetries" ||
        !currentValue;

      if (!shouldPrompt) continue;

      // Determine prompt type
      let promptType: "input" | "password" | "number" | "confirm" = "input";
      if (fieldKey === "apiKey") promptType = "password";
      else if (fieldKey === "concurrency" || fieldKey === "maxRetries")
        promptType = "number";
      else if (fieldKey === "saveConfig") promptType = "confirm";

      const prompt = getFieldPrompt(fieldKey, fieldConfig, currentValue, promptType);

      // Add custom validation with enhanced feedback
      if (promptType === "input" && fieldKey === "baseUrl") {
        prompt.validate = (value: string) => {
          const result = validateUrl(value);
          if (result === true) {
            console.log(`  ${indicators.success} Valid HTTPS URL`);
          }
          return result;
        };
      }

      if (promptType === "password") {
        prompt.validate = (value: string) => {
          const result = validateApiKey(value);
          if (result === true) {
            console.log(
              `  ${indicators.success} API key valid (${value.length} characters)`
            );
          }
          return result;
        };
      }

      sectionPrompts.push(prompt);
    }

    if (sectionPrompts.length === 0) continue;

    printSectionHeader(section, fields[0].sectionIndicator);
    const sectionAnswers = await inquirer.prompt(sectionPrompts, answers);
    answers = { ...answers, ...sectionAnswers };
  }

  // Print completion message
  console.log("");
  console.log(
    `${indicators.success} ${colors.success("Configuration complete!")}`
  );
  console.log("");

  return answers;
}
