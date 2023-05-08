import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {BehaviorSubject, delay, forkJoin, Observable, switchMap} from "rxjs";
import {map} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class ApiCallService {
  private mDelay = 300;

  private URL: string = Object.freeze('http://localhost:3000/');
  mTablesBehaviourSubject: BehaviorSubject<[]>;

  constructor(private http: HttpClient) {
    this.getAllTables();
    this.mTablesBehaviourSubject = new BehaviorSubject<[]>([]);
  }

  createNewTable(data: any) {
    data.id = this.mTablesBehaviourSubject.value.length + 1;
    this.http.post(this.URL + 'tables', data).pipe(delay(this.mDelay)).subscribe({
      complete: () => this.getAllTables()
    });
  }

  setNewRelationObject(data: any) {
    return this.http.post(this.URL + 'relationships', data).pipe(delay(this.mDelay));
  }

  updateTable(data: any): Observable<any> {
    return this.http.put(this.URL + 'tables' + '/' + data.id, data).pipe(delay(this.mDelay));
  }

  getAllTables() {
    this.http.get(this.URL + 'tables')
      .subscribe((data: any) => {
        this.mTablesBehaviourSubject.next(data);
      });
  }

  getRelationShips() {
    return this.http.get(this.URL + 'relationships')
  }

  createRelationShip(table: any, tableToLink: any) {
    return this.getRelationShips().pipe(
      map((value: any) => {
        if (!value[table.id]) {
          value[table.id] = [];
        }
        value[table.id].push(tableToLink.id);
        return {
          ...value
        };
      }),
      switchMap(value => {
        return forkJoin([
          this.updateTable(table).pipe(delay(this.mDelay)),
          this.setNewRelationObject(value).pipe(delay(this.mDelay))
        ]);
      })
    );
  }

  deleteRelationShip(updateTable: any) {
    return this.getRelationShips().pipe(
      map((value: any) => {
        const mObj: any = {};
        for (const key in value) {
          if (key != updateTable.id) {
            mObj[key] = value[key];
          }
        }
        return mObj;
      }),
      switchMap(value => {
        return forkJoin([
          this.updateTable(updateTable).pipe(delay(this.mDelay)),
          this.setNewRelationObject(value).pipe(delay(this.mDelay))
        ]);
      })
    )
  }

  deleteColumn(updateTable: any, column: any) {
    return this.getRelationShips().pipe(
      delay(this.mDelay),
      map((value: any) => {
        const mIndex = value[updateTable.id].indexOf(+column.relation.tableId);
        if (mIndex >= 0) {
          value[updateTable.id].splice(mIndex, 1);
        }
        return value;
      }),
      switchMap(value => {
        const tmpCol = updateTable.columns.find((col: any) => col.name == column.name);
        const mIndex = updateTable.columns.indexOf(tmpCol);
        if (mIndex >= 0) {
          updateTable.columns.splice(mIndex, 1);
        }
        return forkJoin([
          this.setNewRelationObject(value).pipe(delay(this.mDelay)),
          this.updateTable(updateTable).pipe(delay(this.mDelay))
        ]);
      })
    )
  }

  deleteTable(tableToDelete: any) {
    return this.getRelationShips().pipe(
      delay(this.mDelay),
      map((value: any) => {
        const mObj: any = {};
        for (const key in value) {
          if (key != tableToDelete.id) {
            const mIndex = value[key].indexOf(tableToDelete.id);
            if (mIndex >= 0) {
              value[key].splice(mIndex, 1);
            }
            mObj[key] = value[key];
          }
        }
        return mObj;
      }),
      switchMap(value => {
        return forkJoin([
          this.setNewRelationObject(value).pipe(delay(this.mDelay)),
          this.http.delete(this.URL + 'tables/' + tableToDelete.id)
        ]);
      })
    );
  }

}
