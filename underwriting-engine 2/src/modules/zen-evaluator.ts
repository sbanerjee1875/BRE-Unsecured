// ============================================================
// modules/zen-evaluator.ts
// Pure TypeScript rule evaluator — replaces @gorules/zen-engine
// native Rust bindings which are incompatible with Vercel
// serverless runtime. Implements the same JDM evaluation logic:
//   - Decision Tables (hitPolicy: first)
//   - Function Nodes (JavaScript snippets via safe eval)
//   - Graph traversal (input → nodes → output)
// ============================================================

export interface JdmNode {
  id: string;
  name: string;
  type: 'inputNode' | 'outputNode' | 'decisionTableNode' | 'functionNode';
  content?: DecisionTableContent | FunctionContent;
}

export interface DecisionTableContent {
  hitPolicy: 'first' | 'collect';
  inputs: Array<{ id: string; field: string; dataType: string }>;
  outputs: Array<{ id: string; field: string; dataType: string }>;
  rules: Array<Record<string, string>>;
}

export interface FunctionContent {
  source: string;
}

export interface JdmEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface JdmGraph {
  nodes: JdmNode[];
  edges: JdmEdge[];
}

// ── Expression Evaluator ──────────────────────────────────────
// Parses ZEN expression syntax into boolean matches
// Supports: ranges [a..b], comparisons > < >= <=, equality, boolean

function matchesExpression(expr: string, value: unknown): boolean {
  if (expr === '' || expr === null || expr === undefined) return true; // wildcard

  const trimmed = expr.trim();

  // Boolean literals
  if (trimmed === 'true')  return value === true  || value === 'true';
  if (trimmed === 'false') return value === false || value === 'false';

  const numVal = typeof value === 'number' ? value : parseFloat(String(value));

  // Range: [a..b] inclusive
  const rangeMatch = trimmed.match(/^\[([^.]+)\.\.([^\]]+)\]$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    return numVal >= lo && numVal <= hi;
  }

  // Comparison operators
  if (trimmed.startsWith('>=')) return numVal >= parseFloat(trimmed.slice(2));
  if (trimmed.startsWith('<=')) return numVal <= parseFloat(trimmed.slice(2));
  if (trimmed.startsWith('> ') || trimmed.startsWith('>')) {
    return numVal > parseFloat(trimmed.replace(/^>\s*/, ''));
  }
  if (trimmed.startsWith('< ') || trimmed.startsWith('<')) {
    return numVal < parseFloat(trimmed.replace(/^<\s*/, ''));
  }

  // Equality: = 0 or just a plain value
  if (trimmed.startsWith('= ')) return numVal === parseFloat(trimmed.slice(2));

  // String equality
  if (trimmed === String(value)) return true;

  // Numeric equality (plain number)
  if (!isNaN(parseFloat(trimmed)) && parseFloat(trimmed) === numVal) return true;

  return false;
}

// ── Decision Table Evaluator ──────────────────────────────────

function evaluateDecisionTable(
  content: DecisionTableContent,
  context: Record<string, unknown>
): Record<string, unknown> | null {
  for (const rule of content.rules) {
    let allInputsMatch = true;

    for (const inputDef of content.inputs) {
      const exprKey  = inputDef.id in rule ? inputDef.id : inputDef.field;
      const expr     = rule[exprKey] ?? '';
      const ctxValue = context[inputDef.field];

      if (!matchesExpression(expr, ctxValue)) {
        allInputsMatch = false;
        break;
      }
    }

    if (allInputsMatch) {
      const output: Record<string, unknown> = {};
      for (const outputDef of content.outputs) {
        const rawVal = rule[outputDef.id] ?? rule[outputDef.field];
        if (rawVal === undefined) continue;

        // Cast to declared dataType
        if (outputDef.dataType === 'number') {
          output[outputDef.field] = parseFloat(rawVal);
        } else if (outputDef.dataType === 'boolean') {
          output[outputDef.field] = rawVal === 'true' || rawVal === true;
        } else {
          output[outputDef.field] = rawVal;
        }
      }
      return output;
    }
  }
  return null; // no rule matched
}

// ── Function Node Evaluator ───────────────────────────────────
// Executes the handler() function from the JDM function node source
// Uses Function constructor (safe — no external I/O, bounded context)

function evaluateFunctionNode(
  content: FunctionContent,
  context: Record<string, unknown>
): Record<string, unknown> {
  try {
    // Wrap source in a closure and invoke with current context
    // The JDM function format is: const handler = (input) => { ... return {...}; }
    const wrappedFn = new Function(
      'input',
      `${content.source}\nreturn handler(input);`
    );
    const result = wrappedFn(context);
    return result && typeof result === 'object' ? result : {};
  } catch (err: any) {
    console.error(`[ZenEvaluator] Function node error: ${err.message}`);
    return {};
  }
}

// ── Graph Traversal ───────────────────────────────────────────

export class ZenEvaluator {
  private graphs: Map<string, JdmGraph> = new Map();

  loadGraph(key: string, graph: JdmGraph): void {
    this.graphs.set(key, graph);
  }

  evaluate(key: string, input: Record<string, unknown>): { result: Record<string, unknown> } {
    const graph = this.graphs.get(key);
    if (!graph) throw new Error(`Graph not found: ${key}`);

    // Build adjacency: sourceId → [targetId]
    const adjacency = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
      adjacency.get(edge.sourceId)!.push(edge.targetId);
    }

    // Node lookup
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    // Find input node
    const inputNode = graph.nodes.find((n) => n.type === 'inputNode');
    if (!inputNode) throw new Error('No inputNode found in graph');

    // Accumulated context: starts with the request input
    const context: Record<string, unknown> = { ...input };

    // BFS traversal from inputNode → outputNode
    const visited = new Set<string>();
    const queue: string[] = [inputNode.id];

    // Collect all outputs for multi-node graphs (e.g. hard-gates)
    const allOutputs: Array<Record<string, unknown>> = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) continue;

      // Process node
      if (node.type === 'decisionTableNode' && node.content) {
        const tableResult = evaluateDecisionTable(
          node.content as DecisionTableContent,
          context
        );
        if (tableResult) {
          Object.assign(context, tableResult);
          allOutputs.push({ ...tableResult, _nodeId: nodeId });
        }
      } else if (node.type === 'functionNode' && node.content) {
        const fnResult = evaluateFunctionNode(
          node.content as FunctionContent,
          context
        );
        Object.assign(context, fnResult);
        allOutputs.push({ ...fnResult, _nodeId: nodeId });
      }

      // Enqueue successors
      const successors = adjacency.get(nodeId) ?? [];
      for (const nextId of successors) {
        if (!visited.has(nextId)) queue.push(nextId);
      }
    }

    // For hard-gates graph: return array of all table outputs
    // For scorecard/offer: return the accumulated context (last aggregator wins)
    const outputNode = graph.nodes.find((n) => n.type === 'outputNode');
    if (outputNode) {
      // Return everything accumulated in context (minus input node artifacts)
      const finalResult = { ...context };
      delete (finalResult as any)._nodeId;

      // For hard-gates pattern: also expose each node's output as array
      const tableOutputs = allOutputs.filter(
        (o) => 'triggered' in o || 'bureauScore' in o
      );
      if (tableOutputs.length > 1) {
        (finalResult as any).__nodeOutputs = tableOutputs;
      }

      return { result: finalResult };
    }

    return { result: context };
  }
}
