import {
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "../../../../../src"
import { User } from "./User"

@Entity()
export class Comment {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    text: string

    @ManyToOne(() => User, (user) => user.comments, { onDelete: "CASCADE" })
    user: User
}
