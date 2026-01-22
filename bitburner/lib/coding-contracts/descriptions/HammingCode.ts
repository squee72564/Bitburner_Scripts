/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_HAMMINGCODE: Record<string, CodingContractDescription> = {
  'HammingCodes: Encoded Binary to Integer': {
    difficulty: 8,
    desc: (n: string): string => {
      return [
        'You are given the following encoded binary string: \n',
        `'${n}' \n\n`,
        "Decode it as an 'extended Hamming code' and convert it to a decimal value.\n",
        'The binary string may include leading zeroes.\n',
        'A parity bit is inserted at position 0 and at every position N where N is a power of 2.\n',
        "Parity bits are used to make the total number of '1' bits in a given set of data even.\n",
        'The parity bit at position 0 considers all bits including parity bits.\n',
        'Each parity bit at position 2^N alternately considers 2^N bits then ignores 2^N bits, starting at position 2^N.\n',
        'The endianness of the parity bits is reversed compared to the endianness of the data bits:\n',
        'Data bits are encoded most significant bit first and the parity bits encoded least significant bit first.\n',
        'The parity bit at position 0 is set last.\n',
        'There is a ~55% chance for an altered bit at a random index.\n',
        'Find the possible altered bit, fix it and extract the decimal value.\n\n',
        'Examples:\n\n',
        "'11110000' passes the parity checks and has data bits of 1000, which is 8 in binary.\n",
        "'1001101010' fails the parity checks and needs the last bit to be corrected to get '1001101011',",
        'after which the data bits are found to be 10101, which is 21 in binary.\n\n',
        "For more information on the 'rule' of encoding, refer to Wikipedia (https://wikipedia.org/wiki/Hamming_code)",
        'or the 3Blue1Brown videos on Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)',
      ].join(' ');
    },
    solver: (data, answer) => {
      return HammingDecode(data) === answer;
    },
  },
  'HammingCodes: Integer to Encoded Binary': {
    difficulty: 5,
    desc: (n: number): string => {
      return [
        'You are given the following decimal value: \n',
        `${n} \n\n`,
        "Convert it to a binary representation and encode it as an 'extended Hamming code'.\n ",
        "The number should be converted to a string of '0' and '1' with no leading zeroes.\n",
        'A parity bit is inserted at position 0 and at every position N where N is a power of 2.\n',
        "Parity bits are used to make the total number of '1' bits in a given set of data even.\n",
        'The parity bit at position 0 considers all bits including parity bits.\n',
        'Each parity bit at position 2^N alternately considers 2^N bits then ignores 2^N bits, starting at position 2^N.\n',
        'The endianness of the parity bits is reversed compared to the endianness of the data bits:\n',
        'Data bits are encoded most significant bit first and the parity bits encoded least significant bit first.\n',
        'The parity bit at position 0 is set last.\n\n',
        'Examples:\n\n',
        '8 in binary is 1000, and encodes to 11110000 (pppdpddd - where p is a parity bit and d is a data bit)\n',
        '21 in binary is 10101, and encodes to 1001101011 (pppdpdddpd)\n\n',
        "For more information on the 'rule' of encoding, refer to Wikipedia (https://wikipedia.org/wiki/Hamming_code)",
        'or the 3Blue1Brown videos on Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)',
      ].join(' ');
    },
    solver: (data, answer) => {
      return HammingEncode(data) === answer;
    },
  },
};
