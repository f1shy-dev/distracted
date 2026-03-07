import { EOL } from "node:os";

import pc from "picocolors";
import z from "zod/v4";

import { NamedError } from "@/lib/error";

export namespace UI {
  export const CancelledError = NamedError.create("UICancelledError", z.void());

  let blank = false;

  export function println(...message: string[]) {
    blank = false;
    process.stderr.write(message.join(" ") + EOL);
  }

  export function print(...message: string[]) {
    blank = false;
    process.stderr.write(message.join(" "));
  }

  export function empty() {
    if (blank) return;
    println("");
    blank = true;
  }

  export function error(message: string) {
    println(`${pc.red(pc.bold("Error:"))} ${message}`);
  }

  export function markdown(text: string): string {
    return text;
  }
}
