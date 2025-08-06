/*
 * Copyright The Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from "assert";

import { describe, it } from "node:test";
import { isPureFunction } from "./is-pure-function";

type TestCase = { code: string; isPure: boolean; description: string };

describe("isPureFunction", () => {
  (
    [
      // Pure no args
      {
        code: `function myFunc() { return 1; }`,
        isPure: true,
        description:
          "Simple pure named function using `function` keyword - no args",
      },
      {
        code: `function() { return 1; }`,
        isPure: true,
        description:
          "Simple pure anonymous function using `function` keyword - no args",
      },
      {
        code: `() => 1;`,
        isPure: true,
        description:
          "Simple pure function using arrow function - no args, no new scope",
      },
      {
        code: `() => { return 1; }`,
        isPure: true,
        description:
          "Simple pure function using arrow function - no args, new scope",
      },
      {
        code: `async function myFunc() { return 1; }`,
        isPure: true,
        description:
          "Simple pure named async function using `function` keyword - no args",
      },
      {
        code: `async function() { return 1; }`,
        isPure: true,
        description:
          "Simple pure anonymous async function using `function` keyword - no args",
      },
      {
        code: `async () => 1;`,
        isPure: true,
        description:
          "Simple pure function using async arrow function - no args, no new scope",
      },
      {
        code: `async () => { return 1; }`,
        isPure: true,
        description:
          "Simple pure function using async arrow function - no args, new scope",
      },
      // Pure with args
      {
        code: `function myFunc(x) { return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure named function using `function` keyword, with args",
      },
      {
        code: `function(x) { return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure anonymous function using `function` keyword, with args",
      },
      {
        code: `(x) => 1 + x;`,
        isPure: true,
        description: "Simple pure function using arrow func, no new scope",
      },
      {
        code: `(x) => { return 1 + x; }`,
        isPure: true,
        description: "Simple pure function using arrow func, new scope",
      },
      {
        code: `async function myFunc(x) { return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure named async function using `function` keyword",
      },
      {
        code: `async function(x) { return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure anonymous async function using `function` keyword",
      },
      {
        code: `async (x) => 1 + x;`,
        isPure: true,
        description:
          "Simple pure async function using arrow func, no new scope",
      },
      {
        code: `async (x) => { return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure async function using arrow func, new scope, with args",
      },
      {
        code: `async (x, y) => { await y; return 1 + x; }`,
        isPure: true,
        description:
          "Simple pure async function using arrow func, new scope, with args, with await",
      },
      {
        code: `
            function myFunc(x) {
              const y = x + 1;
              return y;
            }
          `,
        isPure: true,
        description: "Pure function with local variable declaration",
      },
      // Impure no args
      {
        code: `function myFunc() { return 1 + x; }`,
        isPure: false,
        description: "Simple impure named function - function keyword, no args",
      },
      {
        code: `function() { return 1 + x; }`,
        isPure: false,
        description:
          "Simple impure anonymous function - function keyword, no args",
      },
      {
        code: `() => { return 1 + x; }`,
        isPure: false,
        description:
          "Simple impure function - arrow function, new scope, no args",
      },
      {
        code: `() => 1 + x;`,
        isPure: false,
        description:
          "Simple impure function - arrow function, now new scope, no args",
      },
      {
        code: `async function myFunc() { return 1 + x; }`,
        isPure: false,
        description:
          "Simple impure named async function - function keyword, no args",
      },
      {
        code: `async function() { return 1 + x; }`,
        isPure: false,
        description:
          "Simple impure anonymous async function - function keyword, no args",
      },
      {
        code: `async () => { return 1 + x; }`,
        isPure: false,
        description: "Simple impure async function - arrow function, new scope",
      },
      {
        code: `async () => 1 + x;`,
        isPure: false,
        description:
          "Simple impure async function - arrow function, now new scope, no args",
      },
      // Impure with args
      {
        code: `function myFunc(x) { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure named function - function keyword, with args",
      },
      {
        code: `function(x) { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure anonymous function - function keyword, with args",
      },
      {
        code: `(x) => { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure function - arrow function, new scope, with args",
      },
      {
        code: `(x) => 1 + y;`,
        isPure: false,
        description:
          "Simple impure function - arrow function, now new scope, with args",
      },
      {
        code: `async function myFunc(x) { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure named async function - function keyword, with args",
      },
      {
        code: `async function(x) { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure anonymous async function - function keyword, with args",
      },
      {
        code: `async (x) => { return 1 + y; }`,
        isPure: false,
        description:
          "Simple impure async function - arrow function, new scope, with args",
      },
      {
        code: `async (x, y) => { await y; return 1 + z; }`,
        isPure: false,
        description:
          "Simple impure async function - arrow function, new scope, with args, with await",
      },
      {
        code: `async (x) => 1 + y;`,
        isPure: false,
        description:
          "Simple impure async function - arrow function, now new scope, with args",
      },
      // Impure external references
      {
        code: `
            function myFunc() { readFile('./file.txt', () => void 0); return 1; }
          `,
        isPure: false,
        description:
          "Impure named function with non-global reference - function keyword",
      },
      {
        code: `
              function myFunc(x) {
              if (!x) {
                  throw new CustomError('ahh');
              }
              return 1;
              }
          `,
        isPure: false,
        description:
          "Impure named function with non global error - function keyword",
      },
      // Impure but with safe external references
      {
        code: `
            function myFunc() { console.log('hi'); return 1; }
            `,
        isPure: true,
        description: "Named function with safe reference - function keyword",
      },
      {
        code: `
          function myFunc(x) {
              if (!x) {
                  console.log('hi');
              }
              return 1;
          }
          `,
        isPure: true,
        description:
          "Named function with safe reference in conditional branch - function keyword",
      },
      {
        code: `
          function myFunc(x) {
              if (!x) {
                  throw new Error('ahh');
              }
              return 1;
          }
          `,
        isPure: true,
        description:
          "Named function with safe error reference - function keyword",
      },
      {
        code: `
            function myFunc(x) {
              return Math.max(x, 10);
            }
          `,
        isPure: true,
        description: "Pure function using allowed global identifier Math",
      },
      {
        code: `
            function myFunc(x) {
              return JSON.parse("1");
            }
          `,
        isPure: true,
        description: "Pure function using allowed global identifier JSON",
      },

      // Impure, references globals
      {
        code: `
            function myFunc() {
              const x = globalThis.x;
              return 1 + x;
            }
          `,
        isPure: false,
        description: "References globalThis",
      },
      {
        code: `
            function myFunc() {
              this.x = 1;
              return 1;
            }
          `,
        isPure: false,
        description: "References this",
      },
      {
        code: `
          () => {
            const y = this.x;
            return 1 + y;
          }
        `,
        isPure: false,
        description: "Arrow function references this",
      },
      {
        code: `
          function myFunc() {
            const x = navigator.x;
            return 1 + x;
          }
        `,
        isPure: false,
        description: "References navigator",
      },
      {
        code: `
          function myFunc(x) {
            return x + process.env.NODE_ENV;
          }
        `,
        isPure: false,
        description:
          "Impure function referencing process.env (not in allowed identifiers)",
      },
      {
        code: `
          function myFunc(x) {
            function inner() {
              return y;
            }
            return x + inner();
          }
        `,
        isPure: false,
        description:
          "Impure function due to closed-over variable in nested function",
      },
      {
        code: `
          function myFunc(x) {
            return eval("x + 1");
          }
        `,
        isPure: false,
        description: "Impure function using eval",
      },
    ] satisfies TestCase[]
  ).forEach(({ code, isPure, description }) => {
    it(description, async () => {
      const isPureResult = isPureFunction(code);

      assert.equal(isPureResult, isPure, description);
    });
  });
});
