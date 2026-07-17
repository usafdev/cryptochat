import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }


    const acceptedRequests = await prisma.friendRequest.findMany({
      where: {
        status: "accepted",
        OR: [
          {
            senderId: userId,
          },
          {
            receiverId: userId,
          },
        ],
      },
      include: {
        sender: {
          select:{
            id:true,
            username:true,
          }
        },
        receiver:{
          select:{
            id:true,
            username:true,
          }
        }
      }
    });


    const friends = acceptedRequests.map((request)=> {
      return request.senderId === userId
        ? request.receiver
        : request.sender;
    });


    const incoming = await prisma.friendRequest.findMany({
      where:{
        receiverId:userId,
        status:"pending"
      },
      include:{
        sender:{
          select:{
            id:true,
            username:true,
          }
        }
      }
    });


    const outgoing = await prisma.friendRequest.findMany({
      where:{
        senderId:userId,
        status:"pending"
      },
      include:{
        receiver:{
          select:{
            id:true,
            username:true,
          }
        }
      }
    });


    return NextResponse.json({
      friends,
      requests:[
        ...incoming,
        ...outgoing
      ]
    });


  } catch(error){

    console.error(error);

    return NextResponse.json(
      {
        error:"Server error"
      },
      {
        status:500
      }
    );

  }
}