import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const fileId = searchParams.get('fileId')

  try {
    if (fileId) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!metaRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch file metadata' }, { status: metaRes.status })
      }
      const metadata = await metaRes.json()

      const streamRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!streamRes.ok) {
        return NextResponse.json({ error: 'Failed to stream file' }, { status: streamRes.status })
      }

      return new NextResponse(streamRes.body, {
        headers: {
          'Content-Type': metadata.mimeType || 'application/pdf',
          'Content-Disposition': `inline; filename="${metadata.name}"`,
          'X-File-Name': metadata.name,
          'X-File-Size': String(metadata.size || 0),
        },
      })
    }

    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name,mimeType)&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!folderRes.ok) {
      return NextResponse.json({ error: 'Failed to list folders' }, { status: folderRes.status })
    }
    const folders = await folderRes.json()

    const foldersWithFiles = await Promise.all(
      folders.files.map(async (folder: { id: string; name: string; mimeType: string }) => {
        const fileRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folder.id}'+in+parents+and+(mimeType='application/pdf'+or+mimeType='application/vnd.google-apps.document')&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const files = fileRes.ok ? (await fileRes.json()).files : []
        return { ...folder, files }
      })
    )

    return NextResponse.json({ folders: foldersWithFiles })
  } catch (error) {
    return NextResponse.json({ error: 'Drive API error' }, { status: 500 })
  }
}
