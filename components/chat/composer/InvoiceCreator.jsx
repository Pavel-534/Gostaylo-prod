'use client'

/**
 * @file components/chat/composer/InvoiceCreator.jsx
 *
 * Обёртка над SendInvoiceDialog с управлением состоянием открытия.
 *
 * Поддерживает два режима управления диалогом:
 *   1. Внутренний (контролируемый внутри): передаётся только onSend.
 *   2. Внешний (управляется родителем): передаются open + onOpenChange.
 *
 * @param {Object}   props
 * @param {Object}   [props.booking]        — объект брони
 * @param {Object}   [props.listing]        — объект листинга
 * @param {Function} props.onSend           — (invoiceData) => void|Promise
 * @param {boolean}  [props.open]           — внешнее управление открытием
 * @param {Function} [props.onOpenChange]   — внешний сеттер
 */

import { useState } from 'react'
import { SendInvoiceDialog } from '@/components/chat-invoice'

export function InvoiceCreator({ booking, listing, onSend, open: openProp, onOpenChange: onOpenChangeProp }) {
  const [openInternal, setOpenInternal] = useState(false)
  const open = openProp !== undefined ? openProp : openInternal
  const setOpen = onOpenChangeProp ?? setOpenInternal

  return (
    <SendInvoiceDialog
      open={open}
      onOpenChange={setOpen}
      booking={booking}
      listing={listing}
      onSend={async (data) => {
        await onSend?.(data)
        setOpen(false)
      }}
    />
  )
}
