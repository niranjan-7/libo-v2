import React from 'react';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  className?: string;
  wrapperClassName?: string;
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({
  className = '',
  wrapperClassName = '',
  children,
  ...props
}) => {
  return (
    <div className={`table-wrap ${wrapperClassName}`}>
      <table className={className} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  ...props
}) => <thead {...props}>{children}</thead>;

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  ...props
}) => <tbody {...props}>{children}</tbody>;

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...props
}) => <tr className={className} {...props}>{children}</tr>;

export const TableHeaderCell: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <th className={className} scope="col" {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => <td className={className} {...props}>{children}</td>;
