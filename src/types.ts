import { Field, Poseidon, Struct } from 'o1js';

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export class WizardState extends Struct({
  spell1: Field,
  spell2: Field,
  posX: Field,
  posY: Field,
  salt: Field,
}) {
  static random(): WizardState {
    let spell1 = Field.from(getRandomInt(4));
    let spell2 = Field.from(getRandomInt(4));
    let posX = Field.from(getRandomInt(4));
    let posY = Field.from(getRandomInt(4));
    let salt = Field.random();

    return new WizardState({
      spell1,
      spell2,
      posX,
      posY,
      salt,
    });
  }

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
