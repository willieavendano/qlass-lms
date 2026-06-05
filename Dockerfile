FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: skip the `postinstall: prisma generate` here (the schema
# isn't copied in this stage). The builder stage runs `prisma generate` after
# copying the full source.
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Full node_modules (superset of the standalone trace) so the Railway
# pre-deploy command (`prisma db push`) has the complete Prisma CLI dep tree
# and bin symlink. server.js still resolves its modules from here.
COPY --from=builder /app/node_modules ./node_modules
# Writable uploads dir for the mounted volume (STORAGE_PROVIDER=local).
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
