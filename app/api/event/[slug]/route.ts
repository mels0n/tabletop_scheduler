import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const event = await prisma.event.findUnique({
            where: { slug: params.slug },
            select: {
                title: true,
                description: true,
                minPlayers: true,
                maxPlayers: true,
                status: true,
                timeSlots: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true
                    }
                },
                _count: {
                    select: { participants: true }
                }
            }
        });

        if (!event) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        return NextResponse.json(event);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
