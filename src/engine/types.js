// 节点输出端口类型
export const OUTPUT_TYPES = {
  apiConfig: { config: 'config' },
  refImage: { image: 'image' },
  refAggregate: { images: 'images' },
  imageGen: { image: 'image' },
  videoGen: { video: 'video' },
}

// 节点输入端口可接受的类型
export const INPUT_ACCEPTS = {
  imageGen: { config: ['config'], refs: ['images', 'image'] },
  videoGen: { config: ['config'], image: ['image'] },
  refAggregate: { img1: ['image'], img2: ['image'], img3: ['image'], img4: ['image'] },
  preview: { media: ['image', 'video'] },
  saveFile: { media: ['image', 'video'] },
}

export function isValidConnection(conn, nodes) {
  const src = nodes.find((n) => n.id === conn.source)
  const dst = nodes.find((n) => n.id === conn.target)
  if (!src || !dst) return false
  const outType = OUTPUT_TYPES[src.type]?.[conn.sourceHandle]
  const accepts = INPUT_ACCEPTS[dst.type]?.[conn.targetHandle]
  return Boolean(outType && accepts && accepts.includes(outType))
}
