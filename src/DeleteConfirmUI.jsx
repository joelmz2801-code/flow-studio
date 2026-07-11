import React, { useEffect, useRef, useState } from 'react'
import './delete-confirm.css'

function runOriginalClick(target, answers) {
 if (!target?.isConnected) return
 const originalConfirm = window.confirm
 let index = 0
 target.dataset.jfsConfirmBypass = 'true'
 window.confirm = () => answers[Math.min(index++, answers.length - 1)] ?? false
 try { target.click() } finally {
 window.confirm = originalConfirm
 delete target.dataset.jfsConfirmBypass
 }
}

export default function DeleteConfirmUI() {
 const [request, setRequest] = useState(null)
 const dialogRef = useRef(null)

 useEffect(() => {
 const intercept = (event) => {
 const button = event.target.closest?.('button')
 if (!button || button.dataset.jfsConfirmBypass === 'true') return
 const label = `${button.title || ''} ${button.getAttribute('aria-label') || ''}`
 const isMessage = /删除此消息|删除消息/.test(label)
 const isChat = /删除对话/.test(label)
 if (!isMessage && !isChat) return
 event.preventDefault()
 event.stopPropagation()
 event.stopImmediatePropagation()
 setRequest({ type: isChat ? 'chat' : 'message', target: button })
 }
 document.addEventListener('click', intercept, true)
 return () => document.removeEventListener('click', intercept, true)
 }, [])

 useEffect(() => {
 const dialog = dialogRef.current
 if (request && dialog && !dialog.open) dialog.showModal()
 if (!request && dialog?.open) dialog.close()
 }, [request])

 const close = () => setRequest(null)
 const execute = (answers) => {
 const target = request?.target
 close()
 queueMicrotask(() => runOriginalClick(target, answers))
 }

 return (
 <dialog ref={dialogRef} className="jfs-delete-dialog" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === dialogRef.current) close() }}>
 <div className="jfs-delete-panel" role="document">
 <div className="jfs-delete-icon" aria-hidden="true">
 <svg viewBox="0 0 24 24"><path d="M4 7h16M9 3h6l1 4H8l1-4Zm-2 4 1 14h8l1-14M10 11v6m4-6v6"/></svg>
 </div>
 <div className="jfs-delete-copy">
 <h2>{request?.type === 'chat' ? '删除这个对话？' : '删除这条消息？'}</h2>
 <p>{request?.type === 'chat' ? '整个对话及其中的所有消息都会被删除，此操作无法撤销。' : '删除后无法恢复，请确认你不再需要这条消息。'}</p>
 </div>
 {request?.type === 'chat' && (
 <button type="button" className="jfs-delete-media" onClick={() => execute([false, true])}>
 仅清除图片和视频
 <span>保留文字记录</span>
 </button>
 )}
 <div className="jfs-delete-actions">
 <button type="button" className="jfs-delete-cancel" onClick={close}>取消</button>
 <button type="button" className="jfs-delete-confirm" onClick={() => execute([true])} autoFocus>
 {request?.type === 'chat' ? '删除对话' : '删除消息'}
 </button>
 </div>
 </div>
 </dialog>
 )
}
