import {
  ArrowFunctionExpression,
  ExpressionStatement,
  Function,
  Identifier,
  Node,
  Program,
  VariableDeclarator,
  FunctionExpression,
  ThisExpression,
} from "acorn";

export function isArrowFunctionExpressionType(
  node: Node
): node is ArrowFunctionExpression {
  return node.type === "ArrowFunctionExpression";
}

export function isFunctionExpressionType(
  node: Node
): node is FunctionExpression {
  return node.type === "FunctionExpression";
}

export function isFunctionType(node: Node): node is Function {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    isArrowFunctionExpressionType(node)
  );
}

export function isExpressionStatementType(
  node: Node
): node is ExpressionStatement {
  return node.type === "ExpressionStatement";
}

export function isVariableDeclaratorType(
  node: Node
): node is VariableDeclarator {
  return node.type === "VariableDeclarator";
}

export function isIdentifierType(node: Node): node is Identifier {
  return node.type === "Identifier";
}

export function isProgramType(node: Node): node is Program {
  return node.type === "Program";
}

export function isThisExpressionType(node: Node): node is ThisExpression {
  return node.type === "ThisExpression";
}
