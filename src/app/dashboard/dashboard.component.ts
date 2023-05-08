import {AfterViewInit, Component} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from "@angular/forms";
import {ApiCallService} from "../services/api-call.service";
import {distinctUntilChanged, interval, Observable, of, throttle} from "rxjs";
import Swal from 'sweetalert2'
import * as d3 from 'd3';
import {TypesVariables} from "../enums/types";
import {DomSanitizer} from "@angular/platform-browser";

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit {

  createTableForm = this.fb.group({
    name: ['', Validators.required]
  });

  mArrayTables$: Observable<Array<any>>;

  createObject = false;

  camelCase = /[a-z]+((\d)|([A-Z0-9][a-z0-9]+))*([A-Z])?/;

  fileUrl: any;

  constructor(private fb: FormBuilder, private api: ApiCallService, private sanitizer: DomSanitizer) {
    this.createTableForm  = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(this.camelCase), Validators.minLength(4)]]
    });
    this.mArrayTables$ = this.api.mTablesBehaviourSubject.asObservable();
  }

  ngAfterViewInit() {
    this.mArrayTables$.subscribe(data => {
      this.createBoard(data);
      this.createFile(data);
    });
  }

  createTable() {
    this.api.createNewTable(this.createTableForm.value);
    this.createTableForm.reset();
    this.createObject = false;
  }

  async updateColumn(table: any) {
    table.columns = table.columns.map((column: any) => {
      column.type = +column.type;
      return column;
    });

    Swal.fire({
      title: 'Updating',
      timerProgressBar: true,
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: async () => {
        Swal.showLoading();
        await new Promise(resolve => {
          this.api.updateTable(table)
            .subscribe({
              error: err => {
                Swal.showValidationMessage(
                  `Request failed: ${err}`
                );
                resolve(false);
              },
              complete: () => {
                this.api.getAllTables();
                resolve(true);
              }
            });
        });
        Swal.hideLoading();
      },
      willClose: () => {
      }
    }).then((result) => {
    })


  }

  createColumn(table: any) {
    Swal.fire({
      title: 'Create new column',
      input: 'text',
      inputAttributes: {
        autocapitalize: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'Create',
      showLoaderOnConfirm: true,
      preConfirm: async (columnName) => {
        return await new Promise(resolve => {

          if (columnName.length === 0) {
            resolve(false);
          }

          const mRes = columnName.match(this.camelCase);

          if (mRes[0] != columnName) {
            Swal.showValidationMessage(
              `Request failed: ${'use Camel Case'}`
            );
            resolve(false);
          } else {
            if (!table.columns) {
              table.columns = new Array();
            }
            table.columns.push({
              name: columnName,
              type: TypesVariables.BOOLEAN,
              relation: {
                tableId: '',
                tableName: '',
                columnName: ''
              }
            });

            this.api.updateTable(table)
              .subscribe({
                error: err => {
                  Swal.showValidationMessage(
                    `Request failed: ${err}`
                  );
                  resolve(false);
                },
                complete: () => {
                  this.api.getAllTables();
                  resolve(true);
                }
              });
          }

        });
      },
      allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
      if (result.isDismissed) {

      } else if (result) {
        Swal.fire({
          title: `Created`,
          icon: 'success'
        });
      }
    })
  }

  createBoard(data: Array<any>) {

    const myElement = document.getElementById('my_board');
    const width = myElement?.getBoundingClientRect().width || 1000;
    const rectWidth = 300;
    d3.selectAll("svg > *").remove();
    const svg = d3.select('svg');

    // const totalElementsInRow = width / (rectWidth * 1.2);
    const totalElementsInRow = 2;

    let cElements = 0;
    let cRows = 0;
    const mMap: any = {};

    for (let i = 0; i < data.length; i++) {
      if (cElements > totalElementsInRow) {
        cRows++;
        cElements = 0;
      }
      mMap[data[i].id] = [(cElements * rectWidth) + rectWidth / 2, (cRows * rectWidth) + 300 / 2];
      cElements++;
    }
    cElements = 0;
    cRows = 0;

    this.api.getRelationShips()
      .subscribe({
        next: (relationships: any) => {
          for (const key in relationships) {
            if (mMap[key] && relationships[key].length > 0) {
              for (let n = 0; n < relationships[key].length; n++) {
                if (mMap[relationships[key][n]]) {
                  svg
                    .append('path')
                    .attr('d',
                      d3.linkHorizontal()({
                        source: mMap[key],
                        target: mMap[relationships[key][n]]
                      })
                    )
                    .attr('stroke', 'black')
                    .attr('fill', 'none');
                }
              }
            }
          }
        },
        complete: () => {
          for (let i = 0; i < data.length; i++) {

            if (cElements > totalElementsInRow) {
              cRows++;
              cElements = 0;
            }
            const mGroup = svg.append('g');

            mGroup
              .append('rect')
              .attr('x', cElements * rectWidth)
              .attr('y', cRows * 320)
              .attr('width', rectWidth - 130)
              .attr('height', 300)
              .attr('stroke', 'black')
              .style('fill', 'white');

            mGroup
              .append('text')
              .text(data[i].name)
              .attr('x', (cElements * rectWidth) + 24)
              .attr('y', (cRows * 320) + 16);

            if (data[i].columns && data[i].columns.length) {
              for (let c = 0; c < data[i].columns.length; c++) {
                mGroup
                  .append('text')
                  .text(data[i].columns[c].name)
                  .attr('x', (cElements * rectWidth) + 8)
                  .attr('y', (cRows * 320) + (16 * (c + 2)));
              }
            }

            cElements++;

          }
        }
      });
  }

  async createRelationShip(selectedTable: any, selectedColumn: any) {
    if (selectedColumn.relation.columnName.length != 0) {
      Swal.fire({
        title: 'Updating',
        timerProgressBar: true,
        allowOutsideClick: () => !Swal.isLoading(),
        didOpen: async () => {
          Swal.showLoading();
          const tmpTable = Object.assign({}, selectedTable);
          tmpTable.columns.find((column: any) => column.name === selectedColumn.name).relation = {
            "tableId": "",
            "tableName": "",
            "columnName": ""
          };
          await new Promise(resolve => {
            this.api.deleteRelationShip(tmpTable)
              .subscribe({
                error: err => {
                  Swal.showValidationMessage(
                    `Request failed: ${err}`
                  );
                  resolve(false);
                },
                complete: () => {
                  this.api.getAllTables();
                  resolve(true);
                }
              });
          });
          Swal.hideLoading();
        },
        willClose: () => {
        }
      }).then((result) => {
      })
      return;
    }


    const {value: tableId} = await Swal.fire({
      title: 'Select table reference for ' + selectedColumn.name,
      input: 'select',
      inputOptions: {
        'Tables': Object.assign(
          {},
          this.api.mTablesBehaviourSubject.value
            .filter((t: any) => t.id != selectedTable.id)
            .map((t: any) => {
              return {
                name: t.name,
                id: t.id
              };
            })
            .reduce((a, v) => ({...a, [v.id]: v.name}), {})
        )
      },
      inputPlaceholder: 'Select a table',
      showCancelButton: true
    });

    if (tableId) {
      const mTable: any = this.api.mTablesBehaviourSubject.value
        .find((t: any) => +t.id === +tableId);

      if (mTable) {
        const {value: columnName} = await Swal.fire({
          title: 'Select column validation from ' + mTable.name,
          input: 'select',
          inputOptions: {
            'Tables': Object.assign(
              {},
              mTable.columns
                .map((c: any, index: any) => {
                  return {
                    id: index,
                    name: c.name,
                  };
                })
                .reduce((a: any, v: any) => ({...a, [v.name]: v.name}), {})
            )
          },
          inputPlaceholder: 'Select a column',
          showCancelButton: true
        });

        if (columnName && tableId) {
          selectedColumn.relation = {
            tableId,
            columnName,
            tableName: mTable.name
          };

          Swal.fire({
            title: 'Updating',
            timerProgressBar: true,
            allowOutsideClick: () => !Swal.isLoading(),
            didOpen: async () => {
              Swal.showLoading();
              await new Promise(resolve => {
                this.api.createRelationShip(selectedTable, mTable)
                  .subscribe({
                    error: err => {
                      Swal.showValidationMessage(
                        `Request failed: ${err}`
                      );
                      resolve(false);
                    },
                    complete: () => {
                      this.api.getAllTables();
                      resolve(true);
                    }
                  });
              });
              Swal.hideLoading();
            },
            willClose: () => {
            }
          }).then((result) => {
          })
        }

      }


    }

  }


  createFile(tables: any) {
    let mData = '';
    for (let i = 0 ; i < tables.length; i++) {
      mData += `model ${tables[i].name} {\n`;
      if (tables[i].columns) {
        for (let c = 0 ; c < tables[i].columns.length; c++) {

          if (tables[i].columns[c].relation.tableName && tables[i].columns[c].relation.tableName.length != 0) {
            mData += `\t${tables[i].columns[c].relation.tableName}\t${tables[i].columns[c].relation.tableName}\t`;
            mData += `@relation(fields: [${tables[i].columns[c].name}], references: [${tables[i].columns[c].relation.columnName}])\n`;
          }

          mData += `\t${tables[i].columns[c].name}\t`;
          switch(tables[i].columns[c].type) {
            case TypesVariables.BOOLEAN:
              mData += `Boolean`;
              break;
            case TypesVariables.INTEGER:
              mData += `Int`;
              break;
            case TypesVariables.STRING:
              mData += `String`;
              break;
          }
          mData += `\n`;
        }
      }
      mData += `} \n\n`;
    }
    const blob = new Blob([mData], {type: 'application/octet-stream'});
    this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  }

  deleteColumn(table: any, column: any) {
    Swal.fire({
      title: 'Are you sure? Delete ' + column.name,
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteColumn(table, column)
          .subscribe({
            complete: () => {
              Swal.fire(
                'Deleted!',
                'Your column has been deleted.',
                'success'
              ).then(() => this.api.getAllTables());
            }
          });

      }
    })
  }

  deleteTable(table: any) {
    Swal.fire({
      title: 'Are you sure? Delete the following table ' + table.name,
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.api.deleteTable(table)
          .subscribe({
            complete: () => {
              Swal.fire(
                'Deleted!',
                'Your table has been deleted.',
                'success'
              ).then(() => this.api.getAllTables());
            }
          });

      }
    })
  }

}
