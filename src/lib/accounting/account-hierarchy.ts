export type AccountRow = { name: string; amount: number };

export type HierarchyRow = {
  label: string;
  fullName: string;
  amount: number;
  depth: number;
  hasChildren: boolean;
};

type TreeNode = {
  label: string;
  fullName: string;
  amount: number;
  inInput: boolean;
  children: Map<string, TreeNode>;
};

function buildTree(rows: AccountRow[]): Map<string, TreeNode> {
  const root = new Map<string, TreeNode>();

  for (const row of rows) {
    const parts = row.name.split(":");
    let current = root;
    const pathParts: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      pathParts.push(part);
      const fullPath = pathParts.join(":");

      if (!current.has(part)) {
        current.set(part, {
          label: part,
          fullName: fullPath,
          amount: 0,
          inInput: false,
          children: new Map()
        });
      }

      const node = current.get(part)!;

      if (i === parts.length - 1) {
        node.amount = row.amount;
        node.fullName = row.name;
        node.inInput = true;
      }

      current = node.children;
    }
  }

  return root;
}

function flattenTree(
  nodes: Map<string, TreeNode>,
  depth: number,
  result: HierarchyRow[]
): void {
  const sorted = [...nodes.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [, node] of sorted) {
    const hasChildren = node.children.size > 0;

    if (node.inInput) {
      result.push({
        label: node.label,
        fullName: node.fullName,
        amount: node.amount,
        depth,
        hasChildren
      });
      if (hasChildren) {
        flattenTree(node.children, depth + 1, result);
      }
    } else {
      // Phantom intermediate node (not in the input rows — zero balance was
      // filtered out upstream). Show its children at the same depth so they
      // don't appear indented under a missing parent.
      if (hasChildren) {
        flattenTree(node.children, depth, result);
      }
    }
  }
}

/**
 * Takes a flat list of { name, amount } rows where `name` uses `:` as a
 * hierarchy separator (Beancount convention) and returns a depth-annotated
 * list suitable for indented rendering.
 *
 * - Parent accounts that have their own balance remain as real rows.
 * - Children are grouped under their parent in DFS order.
 * - `label` is the leaf segment of the name (e.g. "Bloodwork visit").
 * - `depth` starts at 0 for top-level accounts.
 */
export function buildHierarchyRows(rows: AccountRow[]): HierarchyRow[] {
  const tree = buildTree(rows);
  const result: HierarchyRow[] = [];
  flattenTree(tree, 0, result);
  return result;
}

export type HierarchyRowWithValues = HierarchyRow & { values: number[] };

/**
 * Multi-column variant of buildHierarchyRows: takes one { name, amount }[]
 * per column (e.g. current period + compare period, or one per sub-period)
 * and merges them into a single hierarchy where each row carries a
 * `values` array (one number per input column, 0 where an account has no
 * balance in that column) alongside the existing single-column `amount`
 * (set to the first column's value, for callers that only read `amount`).
 */
export function buildHierarchyRowsMulti(rowSets: AccountRow[][]): HierarchyRowWithValues[] {
  const columnCount = rowSets.length;
  const valuesByName = new Map<string, number[]>();

  rowSets.forEach((rows, column) => {
    rows.forEach((row) => {
      const values = valuesByName.get(row.name) ?? new Array(columnCount).fill(0);
      values[column] = row.amount;
      valuesByName.set(row.name, values);
    });
  });

  const mergedRows: AccountRow[] = [...valuesByName.entries()].map(([name, values]) => ({
    name,
    amount: values[0]
  }));

  return buildHierarchyRows(mergedRows).map((row) => ({
    ...row,
    values: valuesByName.get(row.fullName) ?? new Array(columnCount).fill(0)
  }));
}

export type RollupHierarchyRow = HierarchyRow & { isRealAccount: boolean };

function subtreeTotal(node: TreeNode): number {
  let total = node.inInput ? node.amount : 0;
  for (const child of node.children.values()) {
    total += subtreeTotal(child);
  }
  return total;
}

function flattenTreeWithRollup(
  nodes: Map<string, TreeNode>,
  depth: number,
  result: RollupHierarchyRow[]
): void {
  const sorted = [...nodes.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [, node] of sorted) {
    const hasChildren = node.children.size > 0;
    result.push({
      label: node.label,
      fullName: node.fullName,
      amount: subtreeTotal(node),
      depth,
      hasChildren,
      isRealAccount: node.inInput
    });
    if (hasChildren) {
      flattenTreeWithRollup(node.children, depth + 1, result);
    }
  }
}

/**
 * Chart-of-Accounts variant of buildHierarchyRows: unlike the report-facing
 * version, a parent's `amount` here is the SUM of itself plus every
 * descendant (so "Travel" shows total travel spend, not just whatever was
 * posted directly to "Travel" itself), and a parent segment with no account
 * of its own (e.g. "Travel" when only "Travel:Airfare" exists) still gets
 * its own row -- `isRealAccount: false` -- rather than being skipped, since
 * the Chart of Accounts needs to show every level of the tree, not just
 * levels with their own balance. Reports intentionally don't use this
 * (summing parent + children there would double-count on any statement that
 * already lists both as separate lines).
 */
export function buildRollupHierarchyRows(rows: AccountRow[]): RollupHierarchyRow[] {
  const tree = buildTree(rows);
  const result: RollupHierarchyRow[] = [];
  flattenTreeWithRollup(tree, 0, result);
  return result;
}

/**
 * Removes rows whose nearest collapsed ancestor would hide them.
 *
 * The input list must be in DFS order (as produced by buildHierarchyRows).
 * A row is hidden when any preceding row with a shallower or equal depth is
 * in the `collapsedNames` set and is a parent (hasChildren === true).
 */
export function filterCollapsed(
  rows: HierarchyRow[],
  collapsedNames: Set<string>
): HierarchyRow[] {
  const result: HierarchyRow[] = [];
  let hiddenBelowDepth: number | null = null;

  for (const row of rows) {
    if (hiddenBelowDepth !== null && row.depth > hiddenBelowDepth) {
      continue;
    }
    hiddenBelowDepth = null;
    result.push(row);
    if (row.hasChildren && collapsedNames.has(row.fullName)) {
      hiddenBelowDepth = row.depth;
    }
  }

  return result;
}
