import FastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyPluginAsync } from 'fastify';
import FastifyMetrics, { IFastifyMetrics } from 'fastify-metrics';
import { Server } from 'http';
import { PgStore } from '../pg/pg-store';
import { InscriptionsRoutes } from './routes/inscriptions';
import { SatRoutes } from './routes/sats';
import { StatsRoutes } from './routes/stats';
import { StatusRoutes } from './routes/status';
import { isProdEnv } from './util/helpers';
import { PINO_LOGGER_CONFIG } from '@hirosystems/api-toolkit';
import { Brc20Routes } from './routes/brc20';

export const Api: FastifyPluginAsync<
  Record<never, never>,
  Server,
  TypeBoxTypeProvider
> = async fastify => {
  await fastify.register(StatusRoutes);
  await fastify.register(InscriptionsRoutes);
  await fastify.register(SatRoutes);
  await fastify.register(Brc20Routes);
  await fastify.register(StatsRoutes);
};

export async function buildApiServer(args: { db: PgStore }) {
  const fastify = Fastify({
    trustProxy: true,
    logger: PINO_LOGGER_CONFIG,
  }).withTypeProvider<TypeBoxTypeProvider>();

  fastify.decorate('db', args.db);
  if (isProdEnv) {
    await fastify.register(FastifyMetrics, { endpoint: null });
  }
  await fastify.register(FastifyCors);
  await fastify.register(Api, { prefix: '/ordinals/v1' });
  await fastify.register(Api, { prefix: '/ordinals' });

  return fastify;
}

export async function buildPromServer(args: { metrics: IFastifyMetrics }) {
  const promServer = Fastify({
    trustProxy: true,
    logger: PINO_LOGGER_CONFIG,
  });

  promServer.route({
    url: '/metrics',
    method: 'GET',
    logLevel: 'info',
    handler: async (_, reply) => {
      await reply.type('text/plain').send(await args.metrics.client.register.metrics());
    },
  });

  return promServer;
}
