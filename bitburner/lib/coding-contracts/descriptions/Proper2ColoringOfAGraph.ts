/* eslint-disable */
// @ts-nocheck
export type CodingContractDescription = {
  difficulty: number;
  desc: (...args: any[]) => string;
  getAnswer?: (...args: any[]) => any;
  solver?: (...args: any[]) => boolean;
};

function exceptionAlert(_err: Error): void {}

export const CODING_CONTRACT_DESCRIPTIONS_PROPER2COLORINGOFAGRAPH: Record<
  string,
  CodingContractDescription
> = {
  'Proper 2-Coloring of a Graph': {
    difficulty: 7,
    desc: (data: [number, [number, number][]]): string => {
      return [
        `You are given the following data, representing a graph:\n`,
        `${JSON.stringify(data)}\n`,
        `Note that "graph", as used here, refers to the field of graph theory, and has`,
        `no relation to statistics or plotting.`,
        `The first element of the data represents the number of vertices in the graph.`,
        `Each vertex is a unique number between 0 and ${data[0] - 1}.`,
        `The next element of the data represents the edges of the graph.`,
        `Two vertices u,v in a graph are said to be adjacent if there exists an edge [u,v].`,
        `Note that an edge [u,v] is the same as an edge [v,u], as order does not matter.`,
        `You must construct a 2-coloring of the graph, meaning that you have to assign each`,
        `vertex in the graph a "color", either 0 or 1, such that no two adjacent vertices have`,
        `the same color. Submit your answer in the form of an array, where element i`,
        `represents the color of vertex i. If it is impossible to construct a 2-coloring of`,
        `the given graph, instead submit an empty array.\n\n`,
        `Examples:\n\n`,
        `Input: [4, [[0, 2], [0, 3], [1, 2], [1, 3]]]\n`,
        `Output: [0, 0, 1, 1]\n\n`,
        `Input: [3, [[0, 1], [0, 2], [1, 2]]]\n`,
        `Output: []`,
      ].join(' ');
    },
    solver: (data, answer) => {
      //Helper function to get neighbourhood of a vertex
      function neighbourhood(vertex: number): number[] {
        const adjLeft = data[1].filter(([a]) => a == vertex).map(([, b]) => b);
        const adjRight = data[1].filter(([, b]) => b == vertex).map(([a]) => a);
        return adjLeft.concat(adjRight);
      }

      const coloring: (1 | 0 | undefined)[] = Array<1 | 0 | undefined>(data[0]).fill(undefined);
      while (coloring.some((val) => val === undefined)) {
        //Color a vertex in the graph
        const initialVertex: number = coloring.findIndex((val) => val === undefined);
        coloring[initialVertex] = 0;
        const frontier: number[] = [initialVertex];

        //Propagate the coloring throughout the component containing v greedily
        while (frontier.length > 0) {
          const v: number = frontier.pop() || 0;
          const neighbors: number[] = neighbourhood(v);

          //For each vertex u adjacent to v
          for (const u of neighbors) {
            //Set the color of u to the opposite of v's color if it is new,
            //then add u to the frontier to continue the algorithm.
            if (coloring[u] === undefined) {
              if (coloring[v] === 0) coloring[u] = 1;
              else coloring[u] = 0;

              frontier.push(u);
            }

            //Assert u,v do not have the same color
            else if (coloring[u] === coloring[v]) {
              //If u,v do have the same color, no proper 2-coloring exists
              return answer.length === 0;
            }
          }
        }
      }

      return data[1].every(([a, b]) => answer[a] !== answer[b]);
    },
  },
};
