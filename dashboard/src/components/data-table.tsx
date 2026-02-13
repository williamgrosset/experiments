interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage: React.ReactNode;
  onRowClick?: (row: T) => void;
  hoverRows?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage,
  onRowClick,
  hoverRows = true,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-xs font-medium text-zinc-500"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${hoverRows ? "transition-colors hover:bg-zinc-50/50" : ""} ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={col.className ?? "px-4 py-3"}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-zinc-400"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { Column };
