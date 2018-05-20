// @flow

import React, { PureComponent } from "react";
import type { ComponentType } from "react";
import devtools from "unistore/devtools";
import { connect } from "unistore/react";
import * as Types from "./types";
import Table from "./Table";
import type { Props as TableProps } from "./Table";
import Row from "./Row";
import type { Props as RowProps } from "./Row";
import { Cell, enhance as enhanceCell } from "./Cell";
import type { Props as CellProps } from "./Cell";
import DataViewer from "./DataViewer";
import DataEditor from "./DataEditor";
import ActiveCell from "./ActiveCell";
import Selected from "./Selected";
import Copied from "./Copied";
import { range, writeTextToClipboard } from "./util";
import * as PointSet from "./point-set";
import * as Matrix from "./matrix";
import * as Actions from "./actions";
import "./Spreadsheet.css";

declare class ClipboardEvent extends Event {
  clipboardData: DataTransfer;
}

type DefaultCellType = {
  value: string | number | boolean | null
};

const getValue = ({ data }: { data: ?DefaultCellType }) =>
  data ? data.value : null;

export type Props<CellType, Value> = {|
  data: Matrix.Matrix<CellType>,
  Table: ComponentType<TableProps>,
  Row: ComponentType<RowProps>,
  Cell: ComponentType<CellProps<CellType, Value>>,
  DataViewer: Types.DataEditor<CellType, Value>,
  DataEditor: Types.DataViewer<CellType, Value>,
  getValue: Types.getValue<CellType, Value>
|};

type State = {|
  rows: number,
  columns: number
|};

type KeyDownHandlers<Cell> = {
  [eventType: string]: Actions.KeyDownHandler<Cell>
};

/** @todo handle inactive state? */
const keyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: Actions.go(-1, 0),
  ArrowDown: Actions.go(+1, 0),
  ArrowLeft: Actions.go(0, -1),
  ArrowRight: Actions.go(0, +1),
  Tab: Actions.go(0, +1),
  Enter: Actions.edit,
  Backspace: Actions.unfocus
};

const editKeyDownHandlers: KeyDownHandlers<*> = {
  Escape: Actions.view,
  Tab: keyDownHandlers.Tab,
  Enter: keyDownHandlers.ArrowDown
};

const shiftKeyDownHandlers: KeyDownHandlers<*> = {
  ArrowUp: Actions.modifyEdge("row", -1),
  ArrowDown: Actions.modifyEdge("row", 1),
  ArrowLeft: Actions.modifyEdge("column", -1),
  ArrowRight: Actions.modifyEdge("column", 1)
};

class Spreadsheet<CellType, Value> extends PureComponent<{|
  ...$Diff<
    Props<CellType, Value>,
    {|
      data: Matrix.Matrix<CellType>
    |}
  >,
  ...State
|}> {
  static defaultProps = {
    Table,
    Row,
    /** @todo enhance incoming Cell prop */
    Cell: enhanceCell(Cell),
    DataViewer,
    DataEditor,
    getValue
  };

  clip = () => {
    const { store } = this.props;
    const { data, selected } = store.getState();
    const matrix = PointSet.toMatrix(selected, data);
    const filteredMatrix = Matrix.filter(Boolean, matrix);
    const valueMatrix = Matrix.map(getValue, filteredMatrix);
    writeTextToClipboard(Matrix.join(valueMatrix));
  };

  componentDidMount() {
    const { copy, cut, paste } = this.props;
    document.addEventListener("copy", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.clip();
      copy();
    });
    document.addEventListener("cut", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.clip();
      cut();
    });
    document.addEventListener("paste", (event: ClipboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      paste();
    });
  }

  handleKeyPress(state: Types.StoreState<CellType>) {
    if (state.mode === "view" && state.active) {
      return { mode: "edit" };
    }
    return null;
  }

  handleKeyDown(event: SyntheticKeyboardEvent<HTMLElement>) {
    const { key, nativeEvent } = event;
    let handlers;
    // Order matters
    if (state.mode === "edit") {
      handlers = editKeyDownHandlers;
    } else if (event.shiftKey) {
      handlers = shiftKeyDownHandlers;
    } else {
      handlers = keyDownHandlers;
    }
    const handler = handlers[key];
    if (handler) {
      nativeEvent.preventDefault();
      return handler(event);
    }
    return null;
  }

  render() {
    const {
      Table,
      Row,
      Cell,
      DataViewer,
      getValue,
      rows,
      columns
    } = this.props;
    return (
      <div
        className="Spreadsheet"
        onKeyPress={this.handleKeyPress}
        onKeyDown={this.handleKeyDown}
      >
        <Table>
          {range(rows).map(rowNumber => (
            <Row key={rowNumber}>
              {range(columns).map(columnNumber => (
                <Cell
                  key={columnNumber}
                  row={rowNumber}
                  column={columnNumber}
                  DataViewer={DataViewer}
                  getValue={getValue}
                />
              ))}
            </Row>
          ))}
        </Table>
        <ActiveCell DataEditor={DataEditor} getValue={getValue} />
        <Selected />
        <Copied />
      </div>
    );
  }
}

const mapStateToProps = ({ data }: Types.StoreState<*>): State =>
  Matrix.getSize(data);

export default connect(mapStateToProps, {
  copy: Actions.copy,
  cut: Actions.cut,
  paste: Actions.paste
})(Spreadsheet);
