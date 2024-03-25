import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
} from 'o1js';
import { WizardBattle } from './WizardBattle';
import { ApplyProgramm, ProofOfApply } from './proofs/ProofOfApply';
import { StateProgramm } from './proofs/ProofOfState';
import { CommitProgramm } from './proofs/ProofOfCommit';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

interface Player {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}

describe('BatchMessageProcessor', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    players: Player[],
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: WizardBattle;

  beforeAll(async () => {
    let startTime = Date.now();
    if (proofsEnabled) {
      StateProgramm.compile();
      ApplyProgramm.compile();
      CommitProgramm.compile();
    }
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    players = Local.testAccounts.slice(1, 5);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new WizardBattle(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('One big correct game', async () => {
    await localDeploy();
  });
});
