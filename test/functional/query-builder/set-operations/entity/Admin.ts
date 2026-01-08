import { Entity, PrimaryGeneratedColumn, Column } from "../../../../../src"

@Entity()
export class Admin {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    fullName: string

    @Column()
    role: string
}
