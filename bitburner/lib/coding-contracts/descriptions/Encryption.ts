/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_ENCRYPTION: Record<string, CodingContractDescription> = {
  'Encryption I: Caesar Cipher': {
    difficulty: 1,
    desc: (data: [string, number]): string => {
      return [
        'Caesar cipher is one of the simplest encryption technique.',
        'It is a type of substitution cipher in which each letter in the plaintext ',
        'is replaced by a letter some fixed number of positions down the alphabet.',
        'For example, with a left shift of 3, D would be replaced by A, ',
        'E would become B, and A would become X (because of rotation).\n\n',
        'You are given an array with two elements:\n',
        `&nbsp;&nbsp;["${data[0]}", ${data[1]}]\n`,
        'The first element is the plaintext, the second element is the left shift value.\n\n',
        'Return the ciphertext as uppercase string. Spaces remains the same.',
      ].join(' ');
    },
    solver: (data, answer) => {
      // data = [plaintext, shift value]
      // build char array, shifting via map and join to final results
      const cipher = [...data[0]]
        .map((a) =>
          a === ' ' ? a : String.fromCharCode(((a.charCodeAt(0) - 65 - data[1] + 26) % 26) + 65),
        )
        .join('');
      return cipher === answer;
    },
  },
  'Encryption II: Vigenère Cipher': {
    difficulty: 2,
    desc: (data: [string, string]): string => {
      return [
        'Vigenère cipher is a type of polyalphabetic substitution. It uses ',
        'the Vigenère square to encrypt and decrypt plaintext with a keyword.\n\n',
        '&nbsp;&nbsp;Vigenère square:\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;A B C D E F G H I J K L M N O P Q R S T U V W X Y Z \n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; +----------------------------------------------------\n',
        '&nbsp;&nbsp;&nbsp;&nbsp; A | A B C D E F G H I J K L M N O P Q R S T U V W X Y Z \n',
        '&nbsp;&nbsp;&nbsp;&nbsp; B | B C D E F G H I J K L M N O P Q R S T U V W X Y Z A \n',
        '&nbsp;&nbsp;&nbsp;&nbsp; C | C D E F G H I J K L M N O P Q R S T U V W X Y Z A B\n',
        '&nbsp;&nbsp;&nbsp;&nbsp; D | D E F G H I J K L M N O P Q R S T U V W X Y Z A B C\n',
        '&nbsp;&nbsp;&nbsp;&nbsp; E | E F G H I J K L M N O P Q R S T U V W X Y Z A B C D\n',
        '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;...\n',
        '&nbsp;&nbsp;&nbsp;&nbsp; Y | Y Z A B C D E F G H I J K L M N O P Q R S T U V W X\n',
        '&nbsp;&nbsp;&nbsp;&nbsp; Z | Z A B C D E F G H I J K L M N O P Q R S T U V W X Y\n\n',
        'For encryption each letter of the plaintext is paired with the corresponding letter of a repeating keyword.',
        'For example, the plaintext DASHBOARD is encrypted with the keyword LINUX:\n',
        '&nbsp;&nbsp; Plaintext: DASHBOARD\n',
        '&nbsp;&nbsp; Keyword:&nbsp;&nbsp;&nbsp;LINUXLINU\n',
        'So, the first letter D is paired with the first letter of the key L. Therefore, row D and column L of the ',
        'Vigenère square are used to get the first cipher letter O. This must be repeated for the whole ciphertext.\n\n',
        'You are given an array with two elements:\n',
        `&nbsp;&nbsp;["${data[0]}", "${data[1]}"]\n`,
        'The first element is the plaintext, the second element is the keyword.\n\n',
        'Return the ciphertext as uppercase string.',
      ].join(' ');
    },
    solver: (data, answer) => {
      // data = [plaintext, keyword]
      // build char array, shifting via map and corresponding keyword letter and join to final results
      const cipher = [...data[0]]
        .map((a, i) => {
          return a === ' '
            ? a
            : String.fromCharCode(
                ((a.charCodeAt(0) - 2 * 65 + data[1].charCodeAt(i % data[1].length)) % 26) + 65,
              );
        })
        .join('');
      return cipher === answer;
    },
  },
};
