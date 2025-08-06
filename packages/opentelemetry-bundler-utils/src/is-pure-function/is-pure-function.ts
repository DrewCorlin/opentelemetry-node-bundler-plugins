import { parse as acornParse, Program } from "acorn";
import { full, fullAncestor } from "acorn-walk";
import {
  isArrowFunctionExpressionType,
  isExpressionStatementType,
  isFunctionExpressionType,
  isFunctionType,
  isIdentifierType,
  isProgramType,
  isThisExpressionType,
  isVariableDeclaratorType,
} from "./type-helpers";

function parse(sourceCode: string) {
  try {
    return {
      ast: acornParse(sourceCode, {
        ecmaVersion: "latest",
        sourceType: "module",
      }),
      isWrappedExpression: false,
    };
  } catch (err) {
    if (
      err instanceof SyntaxError &&
      err.message.startsWith("Unexpected token (1:")
    ) {
      // An anonymous function using the function keyword (eg `function() { return 1; }`) is invalid standalone code
      // but `(function() { return 1; })` is valid, so lets try to handle that case by wrapping the code in parens
      return {
        ast: acornParse(`(${sourceCode})`, {
          ecmaVersion: "latest",
          sourceType: "module",
        }),
        isWrappedExpression: true,
      };
    }
    throw err;
  }
}

function getFunctionNode(node: Program, isWrappedExpression: boolean) {
  const candidate = node.body[0];
  if (isWrappedExpression) {
    if (
      isExpressionStatementType(candidate) &&
      isFunctionExpressionType(candidate.expression)
    ) {
      return candidate.expression;
    }

    return null;
  }

  if (isFunctionType(candidate)) {
    return candidate;
  }
  if (
    isExpressionStatementType(candidate) &&
    isArrowFunctionExpressionType(candidate.expression)
  ) {
    return candidate.expression;
  }
  return null;
}

const ALLOWED_IDENIFIER_REFERENCES = new Set([
  "console",
  "Math",
  "Error",
  "AssertionError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "SystemError",
  "TypeError",
  "Date",
  "JSON",
  "Number",
  "String",
  "Boolean",
  "parseInt",
  "parseFloat",
]);

// TODO: Handle typescript
export function isPureFunction(sourceCode: string): boolean {
  let isImpure = false;
  const { ast, isWrappedExpression } = parse(sourceCode);

  fullAncestor(ast, (node) => {
    if (!isProgramType(node)) return;

    if (node.body.length !== 1) {
      throw new Error("Node must only have one function");
    }

    const functionNode = getFunctionNode(node, isWrappedExpression);
    if (!functionNode) return;

    const localVars = new Set(
      functionNode.params.filter((p) => isIdentifierType(p)).map((p) => p.name)
    );
    const usedVars = new Set<string>();

    full(functionNode.body, (child) => {
      if (isVariableDeclaratorType(child) && isIdentifierType(child.id)) {
        localVars.add(child.id.name);
      } else if (isIdentifierType(child)) {
        if (!ALLOWED_IDENIFIER_REFERENCES.has(child.name)) {
          // TODO: Configure some means of logging? env var?
          console.warn(
            `Function references disallowed identifier ${child.name}. Only allowed identifier references are: ${Array.from(ALLOWED_IDENIFIER_REFERENCES)}`
          );
          usedVars.add(child.name);
        }
      } else if (isThisExpressionType(child)) {
        console.warn(
          "Function references `this`, which is disallowed in pure functions"
        );
        isImpure = true;
      }
    });

    const closedOver = Array.from(usedVars).filter((v) => !localVars.has(v));

    if (closedOver.length) {
      isImpure = true;
    }
  });

  return !isImpure;
}
