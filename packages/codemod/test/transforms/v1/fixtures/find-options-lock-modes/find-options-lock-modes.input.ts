await queryBuilder.setLock("pessimistic_partial_write").getMany()
await queryBuilder.setLock("pessimistic_write_or_fail").getMany()
repo.find({ lock: { mode: "pessimistic_partial_write" } })
repo.find({ lock: { mode: "pessimistic_write_or_fail", onLocked: "nowait" } })
