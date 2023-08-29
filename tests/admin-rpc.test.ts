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

  test('reposition inscriptions', async () => {
    ENV.BRC20_BLOCK_SCAN_ENABLED = false;
    await db.updateInscriptions(
      new TestChainhookPayloadBuilder()
        .apply()
        .block({
          height: 775617,
          hash: '0x00000000000000000002a90330a99f67e3f01eb2ce070b45930581e82fb7a91d',
          timestamp: 1676913207,
        })
        .transaction({
          hash: '0x38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dc',
        })
        .inscriptionRevealed({
          content_bytes: '0x48656C6C6F',
          content_type: 'image/png',
          content_length: 5,
          inscription_number: 7,
          inscription_fee: 2805,
          inscription_id: '38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dci0',
          inscription_output_value: 10000,
          inscriber_address: 'bc1p3cyx5e2hgh53w7kpxcvm8s4kkega9gv5wfw7c4qxsvxl0u8x834qf0u2td',
          ordinal_number: 257418248345364,
          ordinal_block_height: 650000,
          ordinal_offset: 0,
          satpoint_post_inscription:
            '38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dc:0:0',
          inscription_input_index: 0,
          transfers_pre_inscription: 0,
          tx_index: 0,
        })
        .build()
    );
    await db.updateInscriptions(
      new TestChainhookPayloadBuilder()
        .apply()
        .block({
          height: 775700,
          hash: '0x00000000000000000002a90330a99f67e3f01eb2ce070b45930581e82fb7bbbb',
          timestamp: 1678122360,
        })
        .transaction({
          hash: '0xbdda0d240132bab2af7f797d1507beb1acab6ad43e2c0ef7f96291aea5cc3444',
        })
        .inscriptionTransferred({
          inscription_id: '38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dci0',
          updated_address: 'bc1p3xqwzmddceqrd6x9yxplqzkl5vucta2gqm5szpkmpuvcvgs7g8psjf8htd',
          satpoint_pre_transfer:
            '38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dc:0:0',
          satpoint_post_transfer:
            'bdda0d240132bab2af7f797d1507beb1acab6ad43e2c0ef7f96291aea5cc3444:0:0',
          post_transfer_output_value: 9000,
          tx_index: 0,
        })
        .build()
    );
    await db.updateInscriptions(
      new TestChainhookPayloadBuilder()
        .apply()
        .block({
          height: 775701,
          hash: '0x00000000000000000002a90330a99f67e3f01eb2ce070b45930581e82fb7cccc',
          timestamp: 1678124000,
        })
        .transaction({
          hash: '0xe3af144354367de58c675e987febcb49f17d6c19e645728b833fe95408feab85',
        })
        .inscriptionTransferred({
          inscription_id: '38c46a8bf7ec90bc7f6b797e7dc84baa97f4e5fd4286b92fe1b50176d03b18dci0',
          updated_address: 'bc1pkjq7cerr6h53qm86k9t3dq0gqg8lcfz5jx7z4aj2mpqrjggrnass0u7qqj',
          satpoint_pre_transfer:
            'bdda0d240132bab2af7f797d1507beb1acab6ad43e2c0ef7f96291aea5cc3444:0:0',
          satpoint_post_transfer:
            'e3af144354367de58c675e987febcb49f17d6c19e645728b833fe95408feab85:0:0',
          post_transfer_output_value: 8000,
          tx_index: 0,
        })
        .build()
    );
    const test1 = await db.sql`SELECT * FROM genesis_locations`;
    expect(test1.count).toBe(0);
    const test2 = await db.sql`SELECT * FROM current_locations`;
    expect(test2.count).toBe(0);

    const response1 = await fastify.inject({
      method: 'POST',
      url: '/ordinals/admin/inscriptions/reposition?criteria=genesis',
    });
    expect(response1.statusCode).toBe(200);
    await timeout(100);
    const result1 = await db.sql`SELECT * FROM genesis_locations`;
    expect(result1[0].address).toBe(
      'bc1p3cyx5e2hgh53w7kpxcvm8s4kkega9gv5wfw7c4qxsvxl0u8x834qf0u2td'
    );
    expect(result1[0].block_height).toBe('775617');

    const response2 = await fastify.inject({
      method: 'POST',
      url: '/ordinals/admin/inscriptions/reposition?criteria=current',
    });
    expect(response2.statusCode).toBe(200);
    await timeout(100);
    const result2 = await db.sql`SELECT * FROM current_locations`;
    expect(result2[0].address).toBe(
      'bc1pkjq7cerr6h53qm86k9t3dq0gqg8lcfz5jx7z4aj2mpqrjggrnass0u7qqj'
    );
    expect(result2[0].block_height).toBe('775701');
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
