/** Minimal {{var}} templating. Every value is inserted as plain text. */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`template var ${k} missing`);
    return String(vars[k]);
  });
}

