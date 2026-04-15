await queryBuilder
    .setLock("pessimistic_write")
    .setOnLocked("skip_locked")
    .getMany()
await queryBuilder.setLock("pessimistic_write").setOnLocked("nowait").getMany()
repo.find({
    lock: {
        mode: "pessimistic_write",
        onLocked: "skip_locked",
    },
})
repo.find({ lock: { mode: "pessimistic_write", onLocked: "nowait" } })
