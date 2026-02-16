import { cn } from '../../utils/cn'

interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  emptyMessage?: string
}

export default function Table<T>({ columns, data, keyExtractor, emptyMessage = '데이터가 없습니다.' }: TableProps<T>) {
  return (
    <div className="overflow-x-auto border border-border-primary rounded-lg">
      <table className="w-full">
        <thead>
          <tr className="bg-bg-secondary border-b border-border-primary">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn('px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-bg-hover transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2 text-sm text-text-primary', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
