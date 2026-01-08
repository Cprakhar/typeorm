# Implementation Plan: UNION/INTERSECT/EXCEPT Support

## Overview

Add support for SQL set operations (UNION, INTERSECT, EXCEPT) to TypeORM's QueryBuilder with a phased approach starting with UNION.

**Branch:** `feat/union-intersect-except`

---

## Phase 1: UNION Support (Priority: HIGH)

### 1.1 Architecture Design

#### Expression Map Extension

File: `src/query-builder/SelectQueryBuilder.ts`

Add new properties to `SelectQueryBuilderOption`:

```typescript
interface SelectQueryBuilderOption {
    // ... existing props
    unionQueries?: {
        query: SelectQueryBuilder<any>
        type: "UNION" | "UNION ALL"
    }[]
}
```

#### New Methods in SelectQueryBuilder

```typescript
union(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
unionAll(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
```

### 1.2 Implementation Steps

#### Step 1: Update ExpressionMap

File: `src/query-builder/QueryBuilder.ts`

- Add `setOperations` property to ExpressionMap
- Track union queries with metadata (type, position, parameters)
- Support parameter merging across union queries

#### Step 2: Implement union() and unionAll() Methods

File: `src/query-builder/SelectQueryBuilder.ts` (lines after `cache()` method)

```typescript
union(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity> {
    return this.addSetOperation(query, 'UNION')
}

unionAll(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity> {
    return this.addSetOperation(query, 'UNION ALL')
}

private addSetOperation(
    query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>),
    type: 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT' | 'INTERSECT ALL' | 'EXCEPT ALL',
): SelectQueryBuilder<Entity> {
    const resolvedQuery = typeof query === 'function' ? query() : query

    if (!this.expressionMap.setOperations) {
        this.expressionMap.setOperations = []
    }

    this.expressionMap.setOperations.push({
        query: resolvedQuery,
        type,
        position: this.expressionMap.setOperations.length,
    })

    return this
}
```

#### Step 3: SQL Generation

File: `src/query-builder/SelectQueryBuilder.ts` (modify `getQuery()` / `getSql()`)

Add method: `createSetOperationsExpression()`

Logic:

1. Build main query SQL
2. Iterate through `expressionMap.setOperations`
3. Build each union query SQL
4. Concatenate with SET operator keyword
5. Merge parameters in order

```typescript
private createSetOperationsExpression(): string {
    if (!this.expressionMap.setOperations || this.expressionMap.setOperations.length === 0) {
        return ''
    }

    let sql = ''

    for (const setOp of this.expressionMap.setOperations) {
        sql += ` ${setOp.type} `

        // Get the union query SQL
        const unionSql = setOp.query.clone().disableEscaping().getQuery()

        // Wrap in parentheses for clarity
        sql += `(${unionSql})`
    }

    return sql
}
```

#### Step 4: Parameter Merging

Enhance `getQueryAndParameters()` to merge parameters from all set operations:

```typescript
override getQueryAndParameters(): [string, any[]] {
    const [sql, mainParams] = super.getQueryAndParameters()

    if (!this.expressionMap.setOperations || this.expressionMap.setOperations.length === 0) {
        return [sql, mainParams]
    }

    let fullSql = sql
    let allParams = [...mainParams]

    for (const setOp of this.expressionMap.setOperations) {
        const [unionSql, unionParams] = setOp.query.getQueryAndParameters()
        fullSql += ` ${setOp.type} (${unionSql})`
        allParams = allParams.concat(unionParams)
    }

    return [fullSql, allParams]
}
```

### 1.3 Testing Strategy

File: `test/functional/query-builder/set-operations/union.test.ts`

#### Test Cases:

1. **Basic UNION**
    - Two simple queries
    - Verify column order matches
    - Verify results are deduplicated

2. **UNION ALL**
    - Verify duplicates are preserved
    - Multiple unions chained

3. **Parameter Binding**
    - Parameters from both queries resolved correctly
    - No parameter collision

4. **Column Compatibility**
    - Different column names with aliases
    - Different data types (compatible)
    - Mismatched column counts (should fail gracefully)

5. **Database Compatibility**
    - Test on SQLite, PostgreSQL, MySQL, MSSQL
    - Verify SQL syntax correctness per database

6. **Result Mapping**
    - Entity hydration works correctly
    - Raw results match expected structure

7. **Ordering and Limits**
    - ORDER BY after UNION
    - LIMIT/OFFSET on entire union result
    - Parenthesization when needed

8. **Execution**
    - `getMany()`, `getOne()`, `getRawMany()`, etc.
    - `getManyAndCount()` with union

### 1.4 Files to Create/Modify

| File                                                         | Type   | Change                                     |
| ------------------------------------------------------------ | ------ | ------------------------------------------ |
| `src/query-builder/SelectQueryBuilder.ts`                    | Modify | Add union/unionAll methods, SQL generation |
| `src/query-builder/QueryBuilder.ts`                          | Modify | Add setOperations to ExpressionMap         |
| `src/index.ts`                                               | Verify | No export changes needed                   |
| `test/functional/query-builder/set-operations/union.test.ts` | Create | Comprehensive union tests                  |

---

## Phase 2: INTERSECT Support

### 2.1 Implementation

Reuse framework from Phase 1:

```typescript
intersect(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
intersectAll(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
intersectDistinct(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
```

### 2.2 Testing

File: `test/functional/query-builder/set-operations/intersect.test.ts`

- Basic INTERSECT
- INTERSECT DISTINCT (where supported)
- INTERSECT ALL (where supported)
- Chained with UNION
- Database compatibility

---

## Phase 3: EXCEPT Support

### 3.1 Implementation

```typescript
except(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
exceptAll(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
exceptDistinct(query: SelectQueryBuilder<any> | (() => SelectQueryBuilder<any>)): SelectQueryBuilder<Entity>
```

### 3.2 Database-Specific Handling

- Oracle: Map EXCEPT → MINUS (via DriverUtils check)
- MySQL: Ensure syntax compatibility
- MariaDB: Handle version differences (10.5+)

### 3.3 Testing

File: `test/functional/query-builder/set-operations/except.test.ts`

---

## Phase 4: Complex Operations & Optimization

### 4.1 Parenthesization

Support complex expressions:

```typescript
firstQuery
    .unionAll(secondQuery)
    .exceptDistinct(thirdQuery.intersect(fourthQuery))
```

### 4.2 OrderBy & Limit on Union Result

```typescript
firstQuery.union(secondQuery).orderBy("id", "DESC").limit(10)
```

### 4.3 Performance Optimization

- Lazy parameter merging
- Query plan caching
- Avoid unnecessary parentheses

---

## Commit Strategy

### Commit 1: Core Framework

- Expression map updates
- Base addSetOperation method
- Parameter merging logic

**Message:** `feat: add set operations framework to QueryBuilder`

### Commit 2: UNION Implementation

- union() and unionAll() methods
- SQL generation for UNION
- Tests for UNION operations

**Message:** `feat: implement UNION and UNION ALL operations`

### Commit 3: INTERSECT & EXCEPT

- intersect/intersectAll/intersectDistinct methods
- except/exceptAll/exceptDistinct methods
- Database-specific handling (MINUS for Oracle)

**Message:** `feat: implement INTERSECT and EXCEPT operations with database compatibility`

### Commit 4: Tests & Documentation

- Comprehensive test suite
- Documentation updates
- Edge case handling

**Message:** `test: add comprehensive set operations tests and documentation`

---

## API Examples

### Simple UNION

```typescript
const result = connection
    .createQueryBuilder(User, "user")
    .select("user.id", "user_id")
    .addSelect("user.name", "user_name")
    .union(
        connection
            .createQueryBuilder(Admin, "admin")
            .select("admin.id", "user_id")
            .addSelect("admin.fullName", "user_name"),
    )
    .getMany()
```

### Chained Operations

```typescript
const result = connection
    .createQueryBuilder(A, "a")
    .select("a.id")
    .union(connection.createQueryBuilder(B, "b").select("b.id"))
    .intersect(connection.createQueryBuilder(C, "c").select("c.id"))
    .except(connection.createQueryBuilder(D, "d").select("d.id"))
    .orderBy("id", "DESC")
    .limit(10)
    .getRawMany()
```

### With Parameters

```typescript
const result = connection
    .createQueryBuilder(User, "user")
    .select("user.id")
    .where("user.status = :status", { status: "active" })
    .unionAll(
        connection
            .createQueryBuilder(User, "user")
            .select("user.id")
            .where("user.status = :status2", { status2: "pending" }),
    )
    .getMany()
```

---

## Database Compatibility Matrix

| Feature            | PostgreSQL | MySQL | MariaDB    | SQL Server | Oracle     | SQLite |
| ------------------ | ---------- | ----- | ---------- | ---------- | ---------- | ------ |
| UNION              | ✅         | ✅    | ✅         | ✅         | ✅         | ✅     |
| UNION ALL          | ✅         | ✅    | ✅         | ✅         | ✅         | ✅     |
| UNION DISTINCT     | ✅         | ✅    | ✅         | ✅         | ✅         | ✅     |
| INTERSECT          | ✅         | ✅    | ✅         | ✅         | ✅         | ✅     |
| INTERSECT ALL      | ✅         | ✅    | ⚠️ (10.5+) | ✅         | ❌         | ✅     |
| INTERSECT DISTINCT | ✅         | ✅    | ✅         | ⚠️         | ✅         | ✅     |
| EXCEPT             | ✅         | ✅    | ✅         | ✅         | ❌ (MINUS) | ✅     |
| EXCEPT ALL         | ✅         | ✅    | ⚠️ (10.5+) | ⚠️         | ❌         | ✅     |
| EXCEPT DISTINCT    | ✅         | ✅    | ✅         | ⚠️         | ❌         | ✅     |

✅ = Full support | ⚠️ = Conditional/Version-specific | ❌ = Not supported

---

## Error Handling

### Column Count Mismatch

```typescript
Error: QueryBuilder set operation: column count mismatch (5 vs 3)
```

### Column Type Incompatibility

```typescript
Warning: Column type mismatch in set operation at position 2:
  'varchar' vs 'int'. Database may fail to execute.
```

### Unsupported Operation

```typescript
Error: INTERSECT ALL is not supported on MariaDB < 10.5
Use INTERSECT DISTINCT instead or upgrade MariaDB version
```

---

## Validation Checklist

- [ ] All TypeScript types are correct
- [ ] Parameter binding works across all set operations
- [ ] SQL generation respects database dialect
- [ ] Tests pass on all supported databases
- [ ] No breaking changes to existing API
- [ ] Documentation updated
- [ ] Edge cases handled (empty results, NULL values, etc.)
- [ ] Performance acceptable
- [ ] TypeORM conventions followed (naming, structure)

---

## Future Enhancements (Phase 5+)

1. **Window Functions Integration** - Combine with window functions
2. **CTE Support** - WITH clauses for set operations
3. **Optimization** - Query plan optimization for union queries
4. **Caching** - Cache set operation results
5. **Bulk Operations** - Mass insert/update with union
6. **Subscriptions** - Real-time subscription to union results (if applicable)

---

## Risk Assessment

| Risk                           | Severity | Mitigation                                 |
| ------------------------------ | -------- | ------------------------------------------ |
| Parameter name collision       | Medium   | Use namespacing, parameter tracking        |
| SQL injection in union queries | High     | All queries go through builder, no raw SQL |
| Performance degradation        | Medium   | Lazy evaluation, caching strategy          |
| Database compatibility issues  | High     | Comprehensive test matrix, feature flags   |
| Breaking existing tests        | High     | Thorough regression testing                |

---

## Timeline Estimate

| Phase                 | Effort        | Duration     |
| --------------------- | ------------- | ------------ |
| Phase 1 (UNION)       | 40 hours      | 1 week       |
| Phase 2 (INTERSECT)   | 20 hours      | 3 days       |
| Phase 3 (EXCEPT)      | 20 hours      | 3 days       |
| Phase 4 (Complex Ops) | 30 hours      | 1 week       |
| Testing & Docs        | 30 hours      | 1 week       |
| **Total**             | **140 hours** | **~4 weeks** |

---

## Resources & References

- TypeORM QueryBuilder: [src/query-builder/](src/query-builder/)
- SQL Standards: ISO/IEC 9075 (SQL Standard)
- PostgreSQL UNION docs: https://www.postgresql.org/docs/current/queries-union.html
- MySQL UNION docs: https://dev.mysql.com/doc/refman/8.0/en/union.html
- SQL Server UNION docs: https://learn.microsoft.com/en-us/sql/t-sql/queries/set-operators-union-transact-sql
