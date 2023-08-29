import { cycleMigrations, timeout } from '@hirosystems/api-toolkit';
import { buildAdminRpcServer } from '../src/admin-rpc/init';
import { PgStore, MIGRATIONS_DIR } from '../src/pg/pg-store';
import { TestChainhookPayloadBuilder, TestFastifyServer } from './helpers';
import { ENV } from '../src/env';
import { DbInscriptionType } from '../src/pg/types';
import { SatoshiRarity } from '../src/api/util/ordinal-satoshi';

describe('AdminRPC', () => {
  let db: PgStore;
  let fastify: TestFastifyServer;

  beforeEach(async () => {
    db = await PgStore.connect({ skipMigrations: true });
    fastify = await buildAdminRpcServer({ db });
    await cycleMigrations(MIGRATIONS_DIR);
  });

  afterEach(async () => {
    await fastify.close();
    await db.close();
  });

  test('recount inscriptions', async () => {
    ENV.BRC20_BLOCK_SCAN_ENABLED = false;
    await db.updateInscriptions(
      new TestChainhookPayloadBuilder()
        .apply()
        .block({
          height: 778575,
          hash: '0x00000000000000000002a90330a99f67e3f01eb2ce070b45930581e82fb7a91d',
          timestamp: 1676913207,
        })
        .transaction({
          hash: '0x9f4a9b73b0713c5da01c0a47f97c6c001af9028d6bdd9e264dfacbc4e6790201',
        })
        .inscriptionRevealed({
          content_bytes: `0x${Buffer.from('World').toString('hex')}`,
          content_type: 'text/plain;charset=utf-8',
          content_length: 5,
          inscription_number: 188,
          inscription_fee: 705,
          inscription_id: '9f4a9b73b0713c5da01c0a47f97c6c001af9028d6bdd9e264dfacbc4e6790201i0',
          inscription_output_value: 10000,
          inscriber_address: 'bc1pscktlmn99gyzlvymvrezh6vwd0l4kg06tg5rvssw0czg8873gz5sdkteqj',
          ordinal_number: 257418248345364,
          ordinal_block_height: 650000,
          ordinal_offset: 0,
          satpoint_post_inscription:
            '9f4a9b73b0713c5da01c0a47f97c6c001af9028d6bdd9e264dfacbc4e6790201:0:0',
          tx_index: 0,
          inscription_input_index: 0,
          transfers_pre_inscription: 0,
        })
        .transaction({
          hash: '0xf351d86c6e6cae3c64e297e7463095732f216875bcc1f3c03f950a492bb25421',
        })
        .inscriptionRevealed({
          content_bytes: '0x48656C6C6F',
          content_type: 'image/png',
          content_length: 5,
          inscription_number: 189,
          inscription_fee: 2805,
          inscription_id: 'f351d86c6e6cae3c64e297e7463095732f216875bcc1f3c03f950a492bb25421i0',
          inscription_output_value: 10000,
          inscriber_address: 'bc1p3cyx5e2hgh53w7kpxcvm8s4kkega9gv5wfw7c4qxsvxl0u8x834qf0u2td',
          ordinal_number: 257418248345364,
          ordinal_block_height: 51483,
          ordinal_offset: 0,
          satpoint_post_inscription:
            'f351d86c6e6cae3c64e297e7463095732f216875bcc1f3c03f950a492bb25421:0:0',
          inscription_input_index: 0,
          transfers_pre_inscription: 0,
          tx_index: 0,
        })
        .build()
    );
    await expect(db.counts.getMimeTypeCount(['image/png'])).resolves.toBe('0');
    await expect(db.counts.getInscriptionCount(DbInscriptionType.blessed)).resolves.toBe('0');
    await expect(db.counts.getSatRarityCount([SatoshiRarity.common])).resolves.toBe('0');

    const response1 = await fastify.inject({
      method: 'POST',
      url: '/ordinals/admin/inscriptions/recount?criteria=mime_type',
    });
    expect(response1.statusCode).toBe(200);
    await timeout(100);
    await expect(db.counts.getMimeTypeCount(['image/png'])).resolves.toBe('1');

    const response2 = await fastify.inject({
      method: 'POST',
      url: '/ordinals/admin/inscriptions/recount?criteria=type',
    });
    expect(response2.statusCode).toBe(200);
    await timeout(100);
    await expect(db.counts.getInscriptionCount(DbInscriptionType.blessed)).resolves.toBe('2');

    const response3 = await fastify.inject({
      method: 'POST',
      url: '/ordinals/admin/inscriptions/recount?criteria=sat_rarity',
    });
    expect(response3.statusCode).toBe(200);
    await timeout(100);
    await expect(db.counts.getSatRarityCount([SatoshiRarity.common])).resolves.toBe('2');
  });
});
