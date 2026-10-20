/** Forward warnings and plugin diagnostics from the actual DSH runtime. */
export const name = 'release-live-logging'
export function apply(ctx) {
  ctx.logger.exporter({
    levels: { '': 3 },
    export(message) {
      const args = message.args.map((value) => value instanceof Error ? value.stack : String(value))
      if (message.type !== 'warn' && message.type !== 'error'
        && !args.some((value) => value.includes('effort-slider:'))) return
      process.stderr.write(`[DSH ${message.type}] ${args.join(' ')}\n`)
    },
  })
}
