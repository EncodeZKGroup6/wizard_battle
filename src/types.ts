import { Field, Poseidon, Struct } from 'o1js';

export class WizardState extends Struct({
  spell1: Field,
  spell2: Field,
  posX: Field,
  posY: Field,
  salt: Field,
}) {
  hash(): Field {
    return Poseidon.hash([
      this.spell1,
      this.spell2,
      this.posX,
      this.posY,
      this.salt,
    ]);
  }
}
