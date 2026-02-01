'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAccountContext } from '@/hooks/useAccountContext';
import { useRealtimeCashflowUpdates } from '@/hooks/useRealtimeCashflowUpdates';
import { formatCurrencyValue, formatCurrencyInput } from '@/lib/utils';
import InstitutionSelect, { type InstitutionSelection } from '@/components/brandfetch/InstitutionSelect';
import { buildBrandfetchLogoProxyUrl } from '@/lib/brandfetch';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  institution_domain?: string | null;
  institution_brand_id?: string | null;
  institution_primary_color?: string | null;
  currency: string;
  current_balance: number;
  initial_balance?: number;
  has_transactions?: boolean;
  color?: string;
  icon?: string;
  is_default?: boolean;
  overdraft_limit_cents?: number;
  overdraft_interest_rate_monthly?: number;
  yield_type?: 'fixed' | 'cdi_percentage';
  yield_rate_monthly?: number;
  cdi_percentage?: number;
}

interface CdiRateInfo {
  daily_rate: number;
  monthly_rate: number;
  annual_rate: number;
  date: string;
}

const accountTypes = [
  { value: 'checking', label: 'Conta Corrente', icon: '🏦' },
  { value: 'savings', label: 'Poupança', icon: '💰' },
  { value: 'credit', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'investment', label: 'Investimento', icon: '📈' },
];

const accountColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const accountIcons = [
  // Casa e Moradia
  '🏠', '🏡', '🏢', '🏗️', '🛋️', '🛏️', '🚿', '🚽', '🪟', '🚪',
  // Transporte
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
  '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🚂', '🚆',
  '✈️', '🛫', '🛬', '🚁', '🚤', '🛥️', '🚢', '⛽', '🅿️', '🚦',
  // Alimentação
  '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🧇', '🥞',
  '🧈', '🍞', '🥐', '🥨', '🥯', '🥖', '🧀', '🥗', '🥙', '🥪',
  '🌮', '🌯', '🥫', '🍖', '🍗', '🥩', '🍠', '🥟', '🥠', '🥡',
  '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣',
  '🍤', '🍥', '🍡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰',
  '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕',
  '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃',
  '🥤', '🧃', '🧉', '🧊', '🍽️', '🍴', '🥄', '🥢', '🥡',
  // Compras
  '🛒', '🛍️', '🏪', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽',
  // Saúde
  '💊', '💉', '🩸', '🩹', '🩺', '🏥', '🏨', '🏩', '💆', '💇',
  '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '🚑', '🦷', '🦴', '🧠', '🫀', '🫁', '🦠',
  '🧬', '🧫', '🧪', '🌡️', '🩹', '🩺', '💊', '💉',
  // Educação
  '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📃',
  '📜', '📄', '📰', '🗞️', '📑', '🔖', '🏷️', '💰', '🎓', '🏫',
  '🎒', '🎓', '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧑‍🏫', '👨‍🏫', '👩‍🏫', '📝', '✏️',
  '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '📁', '📂', '🗂️', '📅',
  '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍',
  '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓',
  '🔏', '🔐', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️',
  '⚔️', '🔫', '🏹', '🛡️', '🔧', '🔩', '⚙️', '🗜️', '⚖️', '🦯',
  '🔗', '⛓️', '🪝', '🧰', '🧲', '🪜', '⚗️', '🧪', '🧫', '🧬',
  '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🌡️', '🧹',
  '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪒', '🧽',
  '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸',
  '🖼️', '🪞', '🛒', '🚬', '⚰️', '⚱️', '🗿', '🚰',
  // Lazer e Entretenimento
  '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎸', '🎺', '🎻',
  '🪕', '🎮', '🎯', '🎲', '🎰', '🎳', '🎨', '🎭', '🎪', '🎟️',
  '🎫', '🎠', '🎡', '🎢', '🏟️', '🎪', '🎭', '🎨', '🎬', '🎤',
  '🎧', '🎼', '🎹', '🥁', '🎷', '🎸', '🎺', '🎻', '🪕', '🎮',
  '🎯', '🎲', '🎰', '🎳', '🎭', '🎨', '🎪', '🎟️', '🎫', '🎠',
  '🎡', '🎢', '🏟️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻',
  '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬',
  '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️',
  '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑',
  '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃',
  '🌌', '🌉', '🌁', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐',
  '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏',
  '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹',
  '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🏋️‍♂️',
  '🏋️‍♀️', '🤼', '🤼‍♂️', '🤼‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '⛹️', '⛹️‍♂️',
  '⛹️‍♀️', '🤺', '🤾', '🤾‍♂️', '🤾‍♀️', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🏇',
  '🧘', '🧘‍♂️', '🧘‍♀️', '🏄', '🏄‍♂️', '🏄‍♀️', '🏊', '🏊‍♂️', '🏊‍♀️',
  '🤽', '🤽‍♂️', '🤽‍♀️', '🚣', '🚣‍♂️', '🚣‍♀️', '🧗', '🧗‍♂️', '🧗‍♀️',
  '🚵', '🚵‍♂️', '🚵‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🏆', '🥇', '🥈',
  '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🤹‍♂️',
  '🤹‍♀️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
  '🎷', '🎸', '🎺', '🎻', '🪕', '🎮', '🎯', '🎲', '🎰', '🎳',
  // Viagem
  '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️',
  '🚀', '🛸', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️',
  '🌋', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭',
  '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩',
  '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️',
  '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆',
  '🏙️', '🌃', '🌌', '🌉', '🌁',
  // Serviços
  '💇', '💆', '🧖', '🧖‍♂️', '🧖‍♀️', '💅', '🤳', '💃', '🕺', '👯',
  '👯‍♂️', '👯‍♀️', '🧑‍🤝‍🧑', '👭', '👫', '👬', '💏', '💑', '👪', '👨‍👩‍👦',
  '👨‍👩‍👧', '👨‍👩‍👧‍👦', '👨‍👩‍👦‍👦', '👨‍👩‍👧‍👧', '👨‍👦', '👨‍👦‍👦', '👨‍👧', '👨‍👧‍👦', '👨‍👧‍👧', '👩‍👦',
  '👩‍👦‍👦', '👩‍👧', '👩‍👧‍👦', '👩‍👧‍👧',
  // Tecnologia
  '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽',
  '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️',
  '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
  '⏰', '⏲️', '🕰️', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒',
  '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗',
  '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦', '🌑', '🌒', '🌓',
  '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌡️',
  '☀️', '🌝', '🌞', '🪐', '⭐', '🌟', '🌠', '🌌', '☁️', '⛅',
  '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '❄️', '🌬️', '💨', '🌪️',
  '🌫️', '🌈', '☂️', '☔', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥',
  '💧', '🌊', '🎄', '✨', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑',
  '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇',
  '🥈', '🥉',
  // Dinheiro e Negócios
  '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '💱',
  '💲', '💹', '📈', '📉', '📊', '🏦', '🏧', '💎', '⚖️', '🛒',
  '🛍️', '🧮', '🏢', '💼', '👔', '👕', '👖', '🧣', '🧤', '🧥',
  '🧦', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '👚', '👛',
  '👜', '👝', '🛍️', '🎒', '👞', '👟', '🥾', '🥿', '👠', '👡',
  '🩰', '👢', '👑', '👒', '🎩', '🎓', '🧢', '🪖', '⛑️', '📿',
  '💄', '💍', '💎', '🔇', '🔈', '🔉', '🔊', '📢', '📣', '📯',
  '🔔', '🔕', '🎼', '🎵', '🎶', '🎙️', '🎚️', '🎛️', '🎤', '🎧',
  '📻', '🎷', '🎸', '🎹', '🎺', '🎻', '🪕', '🥁', '📱', '📲',
  '☎️', '📞', '📟', '📠', '🔋', '🔌', '💻', '🖥️', '🖨️', '⌨️',
  '🖱️', '🖲️', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞️', '📽️',
  '🎬', '📺', '📷', '📸', '📹', '📼', '🔍', '🔎', '🕯️', '💡',
  '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚',
  '📓', '📒', '📃', '📜', '📄', '📰', '🗞️', '📑', '🔖', '🏷️',
  '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '💱',
  '💲', '💹', '📈', '📉', '📊', '🏦', '🏧', '💎', '⚖️', '🛒',
  // Segurança
  '🔐', '🔒', '🔓', '🔏', '🗝️', '🔑', '🛡️', '⚔️', '🗡️', '🔫',
  '🏹', '🛡️', '🚔', '🚓', '🚒', '🚑', '🚐', '🚚', '🚛', '🚜',
  '🚔', '🚓', '🚒', '🚑', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲',
  '🛵', '🏍️', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶',
  '🚤', '🛳️', '⛴️', '🛥️', '🚢', '✈️', '🛩️', '🛫', '🛬', '💺',
  '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🌍', '🌎', '🌏',
  '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '⛺', '🏠',
  '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥',
  '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍',
  '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄',
  '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁',
  // Animais
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
  '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
  '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
  '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
  '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
  '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛',
  '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖',
  '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈',
  '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝',
  '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉',
  '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀',
  '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷',
  '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜',
  '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙',
  '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '🔥',
  '💥', '☄️', '☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️', '⛈️', '🌩️',
  '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌈', '☂️',
  '☔', '💧', '💦', '🌊',
  // Natureza
  '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍',
  '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀',
  '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕',
  '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍',
  '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '☄️',
  '☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️',
  '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌈', '☂️', '☔', '💧',
  '💦', '🌊',
  // Outros
  '⭐', '🌟', '💫', '✨', '⚡', '🔥', '💥', '☄️', '🎊', '🎉',
  '🎀', '🎁', '🎗️', '🏆', '🏅', '🥇', '🥈', '🥉', '🎖️', '🎟️',
  '🎫', '🎪', '🤹', '🤹‍♂️', '🤹‍♀️', '🎭', '🩰', '🎨', '🎬', '🎤',
  '🎧', '🎼', '🎹', '🥁', '🎷', '🎸', '🎺', '🎻', '🪕', '🎮',
  '🎯', '🎲', '🎰', '🎳', '🧩', '🧸', '🪀', '🪁', '♟️', '🃏',
  '🀄', '🎴', '🎠', '🎡', '🎢', '🏟️', '🎪', '🛝', '🛷', '🛹',
  '🛼', '🏮', '🪔', '🎑', '🎄', '🎃', '🎅', '🤶', '🧑‍🎄', '🦌',
  '🧝', '🧝‍♂️', '🧝‍♀️', '🧙', '🧙‍♂️', '🧙‍♀️', '🧛', '🧛‍♂️', '🧛‍♀️', '🧜',
  '🧜‍♂️', '🧜‍♀️', '🧚', '🧚‍♂️', '🧚‍♀️', '👼', '🤰', '🤱', '👩‍🍼', '👨‍🍼',
  '🧑‍🍼', '🙇', '🙇‍♂️', '🙇‍♀️', '💁', '💁‍♂️', '💁‍♀️', '🙅', '🙅‍♂️', '🙅‍♀️',
  '🙆', '🙆‍♂️', '🙆‍♀️', '🙋', '🙋‍♂️', '🙋‍♀️', '🧏', '🧏‍♂️', '🧏‍♀️', '🤦',
  '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️', '🙎', '🙎‍♂️', '🙎‍♀️', '🙍', '🙍‍♂️',
  '🙍‍♀️', '💇', '💇‍♂️', '💇‍♀️', '💆', '💆‍♂️', '💆‍♀️', '🧖', '🧖‍♂️', '🧖‍♀️',
  '💅', '🤳', '💃', '🕺', '👯', '👯‍♂️', '👯‍♀️', '🕴️', '👩‍🦽', '👨‍🦽',
  '🧑‍🦽', '👩‍🦼', '👨‍🦼', '🧑‍🦼', '🚶', '🚶‍♂️', '🚶‍♀️', '👩‍🦯', '👨‍🦯', '🧑‍🦯',
  '🧎', '🧎‍♂️', '🧎‍♀️', '🏃', '🏃‍♂️', '🏃‍♀️', '💃', '🕺', '🛀', '🛌',
  '🧑‍🤝‍🧑', '👭', '👫', '👬', '💏', '💑', '👪', '👨‍👩‍👦', '👨‍👩‍👧', '👨‍👩‍👧‍👦',
  '👨‍👩‍👦‍👦', '👨‍👩‍👧‍👧', '👨‍👦', '👨‍👦‍👦', '👨‍👧', '👨‍👧‍👦', '👨‍👧‍👧', '👩‍👦', '👩‍👦‍👦', '👩‍👧',
  '👩‍👧‍👦', '👩‍👧‍👧', '🗣️', '👤', '👥', '🫂', '👣', '🐵', '🐒', '🦍',
  '🦧', '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱',
  '🐈', '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓',
  '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽',
  '🐏', '🐑', '🦙', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣',
  '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫',
  '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘',
  '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧',
  '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶', '🦩', '🦚', '🦜',
  '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳',
  '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🐌',
  '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🪳', '🕷️', '🕸️',
  '🦂', '🦟', '🪰', '🪱', '🦠', '💐', '🌸', '💮', '🏵️', '🌹',
  '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴',
  '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍄', '🌰',
  '🦀', '🦞', '🦐', '🦑', '🌍', '🌎', '🌏', '🌐', '🪨', '🌑',
  '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛',
  '🌜', '☀️', '🌝', '🌞', '⭐', '🌟', '🌠', '☁️', '⛅', '⛈️',
  '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '❄️', '🌬️', '💨', '🌪️', '🌫️',
  '🌈', '☂️', '☔', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧',
  '🌊',
];

const DEFAULT_ACCOUNT_COLOR = accountColors[0] || '#3b82f6';
const DEFAULT_ACCOUNT_ICON = accountIcons[0] || '🏦';

const getAccountTypeIcon = (type: string) =>
  accountTypes.find((accountType) => accountType.value === type)?.icon || DEFAULT_ACCOUNT_ICON;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [originalInitialBalanceCents, setOriginalInitialBalanceCents] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [pluggyLogos, setPluggyLogos] = useState<Record<string, string | null>>({});
  const backfillInFlight = useRef(new Set<string>());
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking',
    institution: '',
    institution_domain: '',
    institution_brand_id: '',
    institution_primary_color: '',
    currency: 'BRL',
    initial_balance: '',
    color: DEFAULT_ACCOUNT_COLOR,
    icon: DEFAULT_ACCOUNT_ICON,
    has_overdraft: false,
    overdraft_limit: '',
    overdraft_interest_rate: '',
    has_yield: false,
    yield_type: 'fixed' as 'fixed' | 'cdi_percentage',
    yield_rate: '',
    cdi_percentage: '',
  });
  const [cdiRate, setCdiRate] = useState<CdiRateInfo | null>(null);
  const [loadingCdi, setLoadingCdi] = useState(false);
  const { toast } = useToast();
  const { context: accountContext, activeAccountId } = useAccountContext();
  const ownerId = activeAccountId || accountContext?.currentUserId || null;

  // Fetch CDI rate when dialog opens with yield enabled
  const fetchCdiRate = async () => {
    if (loadingCdi) return;
    setLoadingCdi(true);
    try {
      const res = await fetch('/api/cdi');
      if (res.ok) {
        const data = await res.json();
        setCdiRate(data);
      }
    } catch (error) {
      console.error('Error fetching CDI rate:', error);
    } finally {
      setLoadingCdi(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchPluggyLogos();
  }, []);

  useRealtimeCashflowUpdates({
    ownerId,
    onRefresh: () => {
      fetchAccounts();
      fetchPluggyLogos();
    },
    tables: ['accounts'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
  });

  const fetchPluggyLogos = async () => {
    try {
      console.log('[Accounts] Fetching Pluggy logos...');
      const res = await fetch('/api/accounts/pluggy-links');
      if (res.ok) {
        const data = await res.json();
        console.log('[Accounts] Pluggy logos received:', data);
        console.log('[Accounts] Logo map:', data.logos);
        // Log each logo URL to see what connector_id is being used
        Object.entries(data.logos || {}).forEach(([accountId, logoUrl]) => {
          const connectorIdMatch = (logoUrl as string)?.match(/connector-icons\/(\d+)\.svg/);
          console.log(`[Accounts] Account ${accountId}: logo=${logoUrl}, connector_id=${connectorIdMatch?.[1] || 'not found'}`);
        });
        setPluggyLogos(data.logos || {});
      } else {
        const errorData = await res.json();
        console.error('[Accounts] Error fetching Pluggy logos:', res.status, errorData);
      }
    } catch (error) {
      console.error('[Accounts] Error fetching Pluggy logos:', error);
    }
  };

  // Fetch CDI rate when dialog opens
  useEffect(() => {
    if (dialogOpen && formData.has_yield && !cdiRate) {
      fetchCdiRate();
    }
  }, [dialogOpen, formData.has_yield]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Falha ao carregar contas',
        description: 'Não foi possível carregar as contas. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'O nome da conta é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingAccount
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';

      const initialBalanceValue = formData.initial_balance.replace(',', '.');
      const initialBalanceCents = Math.round(parseFloat(initialBalanceValue || '0') * 100);
      const body: any = {
        name: formData.name.trim(),
        type: formData.type,
        institution: formData.institution.trim() || undefined,
        institution_domain: formData.institution_domain || undefined,
        institution_brand_id: formData.institution_brand_id || undefined,
        institution_primary_color: formData.institution_primary_color || undefined,
        currency: formData.currency,
        color: formData.color,
        icon: formData.icon,
      };

      if (!editingAccount || originalInitialBalanceCents === null || initialBalanceCents !== originalInitialBalanceCents) {
        body.initial_balance_cents = initialBalanceCents;
      }

      // Add overdraft fields if enabled
      if (formData.has_overdraft) {
        body.overdraft_limit_cents = Math.round(parseFloat(formData.overdraft_limit || '0') * 100);
        // Parse with comma support for Brazilian format
        const interestValue = formData.overdraft_interest_rate.replace(',', '.');
        body.overdraft_interest_rate_monthly = parseFloat(interestValue || '0');
      } else {
        body.overdraft_limit_cents = 0;
        body.overdraft_interest_rate_monthly = 0;
      }

      // Add yield fields if enabled
      if (formData.has_yield) {
        body.yield_type = formData.yield_type;
        if (formData.yield_type === 'fixed') {
          // Parse with comma support for Brazilian format
          const yieldValue = formData.yield_rate.replace(',', '.');
          body.yield_rate_monthly = parseFloat(yieldValue || '0');
          body.cdi_percentage = undefined;
        } else {
          // CDI percentage
          body.yield_rate_monthly = 0;
          body.cdi_percentage = parseFloat(formData.cdi_percentage || '0');
        }
      } else {
        body.yield_type = 'fixed';
        body.yield_rate_monthly = 0;
        body.cdi_percentage = undefined;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar conta');
      }

      toast({
        title: 'Sucesso',
        description: editingAccount ? 'Conta atualizada' : 'Conta criada',
      });

      fetchAccounts();
      fetchPluggyLogos();
      closeDialog();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;

    try {
      const res = await fetch(`/api/accounts/${accountToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir conta');
      }

      toast({
        title: 'Sucesso',
        description: 'Conta excluída',
      });

      fetchAccounts();
      fetchPluggyLogos();
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    const initialBalanceValue = account.initial_balance ?? account.current_balance ?? 0;
    setOriginalInitialBalanceCents(Math.round(initialBalanceValue * 100));
    const hasYield = account.yield_type === 'cdi_percentage'
      ? (account.cdi_percentage || 0) > 0
      : (account.yield_rate_monthly || 0) > 0;
    setFormData({
      name: account.name,
      type: account.type,
      institution: account.institution || '',
      institution_domain: account.institution_domain || '',
      institution_brand_id: account.institution_brand_id || '',
      institution_primary_color: account.institution_primary_color || '',
      currency: account.currency,
      initial_balance: initialBalanceValue.toString(),
      color: account.color || account.institution_primary_color || DEFAULT_ACCOUNT_COLOR,
      icon: account.icon || getAccountTypeIcon(account.type),
      has_overdraft: (account.overdraft_limit_cents || 0) > 0,
      overdraft_limit: account.overdraft_limit_cents ? formatCurrencyInput(account.overdraft_limit_cents / 100) : '',
      overdraft_interest_rate: account.overdraft_interest_rate_monthly ? account.overdraft_interest_rate_monthly.toString() : '',
      has_yield: hasYield,
      yield_type: account.yield_type || 'fixed',
      yield_rate: account.yield_rate_monthly 
        ? account.yield_rate_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) 
        : '',
      cdi_percentage: account.cdi_percentage ? account.cdi_percentage.toString() : '',
    });
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    setOriginalInitialBalanceCents(0);
    setFormData({
      name: '',
      type: 'checking',
      institution: '',
      institution_domain: '',
      institution_brand_id: '',
      institution_primary_color: '',
      currency: 'BRL',
      initial_balance: '',
      color: DEFAULT_ACCOUNT_COLOR,
      icon: getAccountTypeIcon('checking'),
      has_overdraft: false,
      overdraft_limit: '',
      overdraft_interest_rate: '',
      has_yield: false,
      yield_type: 'fixed',
      yield_rate: '',
      cdi_percentage: '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setOriginalInitialBalanceCents(null);
  };

  useEffect(() => {
    const backfillInstitutionDomains = async () => {
      const candidates = accounts.filter(
        (account) =>
          account.institution &&
          !account.institution_domain &&
          !backfillInFlight.current.has(account.id)
      );

      for (const account of candidates) {
        if (!account.institution) continue;
        const query = account.institution.trim();
        if (query.length < 2) continue;

        backfillInFlight.current.add(account.id);
        try {
          const searchRes = await fetch(`/api/brandfetch/search?query=${encodeURIComponent(query)}`);
          const searchData = await searchRes.json();
          const firstResult = Array.isArray(searchData?.results)
            ? searchData.results.find((result: any) => result.domain)
            : null;

          if (!firstResult?.domain) {
            continue;
          }

          let primaryColor: string | null = null;
          let brandId: string | null = firstResult.brandId || null;

          const brandRes = await fetch(
            `/api/brandfetch/brand?domain=${encodeURIComponent(firstResult.domain)}`
          );
          if (brandRes.ok) {
            const brandData = await brandRes.json();
            primaryColor = brandData?.primaryColor || null;
            brandId = brandData?.brandId || brandId;
          }

          const patchRes = await fetch(`/api/accounts/${account.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              institution_domain: firstResult.domain,
              institution_brand_id: brandId,
              institution_primary_color: primaryColor,
            }),
          });

          if (patchRes.ok) {
            setAccounts((prev) =>
              prev.map((item) =>
                item.id === account.id
                  ? {
                      ...item,
                      institution_domain: firstResult.domain,
                      institution_brand_id: brandId || undefined,
                      institution_primary_color: primaryColor || undefined,
                    }
                  : item
              )
            );
          }
        } catch (error) {
          console.error('[Accounts] Failed to backfill brand domain:', error);
        }
      }
    };

    if (accounts.length > 0) {
      backfillInstitutionDomains();
    }
  }, [accounts]);

  const handleTypeChange = (nextType: string) => {
    setFormData((prev) => ({
      ...prev,
      type: nextType,
      icon: getAccountTypeIcon(nextType),
    }));
  };

  const handleInstitutionChange = (selection: InstitutionSelection) => {
    setFormData((prev) => ({
      ...prev,
      institution: selection.name,
      institution_domain: selection.domain || '',
      institution_brand_id: selection.brandId || '',
      institution_primary_color: selection.primaryColor || '',
      color: selection.primaryColor || prev.color || DEFAULT_ACCOUNT_COLOR,
    }));
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || account.type === filterType;
    return matchesSearch && matchesType;
  });

  // Alias para manter compatibilidade
  const formatCurrency = formatCurrencyValue;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-full">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl sm:text-2xl md:text-3xl font-bold">Contas</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Gerencie suas contas bancárias e cartões</p>
        </div>
        <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto flex-shrink-0">
          <i className='bx bx-plus mr-2'></i>
          <span className="hidden sm:inline">Nova Conta</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-full">
          <div className="flex-1 relative min-w-0">
            <i className='bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'></i>
            <Input
              placeholder="Buscar contas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full max-w-full"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm sm:text-base flex-shrink-0 w-full sm:w-auto"
          >
            <option value="all">Todos os tipos</option>
            {accountTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className='bx bx-loader-alt bx-spin text-4xl text-primary'></i>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="glass-card p-12 text-center max-w-full">
          <i className='bx bx-wallet text-6xl text-muted-foreground mb-4'></i>
          <h3 className="text-lg font-medium mb-2">Nenhuma conta encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'Tente ajustar sua busca' : 'Comece adicionando sua primeira conta'}
          </p>
          {!searchTerm && (
            <Button onClick={openNewDialog}>
              <i className='bx bx-plus mr-2'></i>
              Adicionar Conta
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-full">
          {filteredAccounts.map((account) => {
            const pluggyLogo = pluggyLogos[account.id];
            const brandLogo = account.institution_domain
              ? buildBrandfetchLogoProxyUrl({
                  identifier: `domain/${account.institution_domain}`,
                  size: 32,
                  theme: 'dark',
                  type: 'icon',
                })
              : null;
            const displayLogo = pluggyLogo || brandLogo;
            const hasLogo = !!displayLogo;
            return (
              <div key={account.id} className="glass-card p-4 hover:shadow-lg transition-shadow relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                        hasLogo ? 'overflow-hidden' : ''
                      }`}
                      style={{
                        backgroundColor: hasLogo
                          ? 'transparent'
                          : `${account.institution_primary_color || account.color || DEFAULT_ACCOUNT_COLOR}20`,
                      }}
                    >
                      {displayLogo ? (
                        <img
                          src={displayLogo}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        account.icon || DEFAULT_ACCOUNT_ICON
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{account.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.institution || accountTypes.find(t => t.value === account.type)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditDialog(account)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <i className='bx bx-edit text-lg'></i>
                    </button>
                    <button
                      onClick={() => {
                        setAccountToDelete(account);
                        setDeleteDialogOpen(true);
                      }}
                      className="p-2 hover:bg-red-500/10 text-negative rounded-lg transition-colors"
                    >
                      <i className='bx bx-trash text-lg'></i>
                    </button>
                  </div>
                </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
                    {accountTypes.find(t => t.value === account.type)?.label || account.type}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo</span>
                  <span className={`font-semibold ${account.current_balance >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatCurrency(account.current_balance)}
                  </span>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Modifique os dados da conta' : 'Adicione uma nova conta bancária'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da conta"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background"
                >
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <InstitutionSelect
                label="Instituição"
                placeholder="Busque o banco"
                value={{
                  name: formData.institution,
                  domain: formData.institution_domain || undefined,
                  brandId: formData.institution_brand_id || undefined,
                  primaryColor: formData.institution_primary_color || undefined,
                  isManual: !formData.institution_domain && !!formData.institution,
                }}
                onChange={handleInstitutionChange}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Saldo Inicial</label>
              <Input
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saldo atual = saldo inicial + transações.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Saldo Atual</label>
              <Input
                type="text"
                value={formatCurrency(editingAccount?.current_balance || 0)}
                disabled
              />
              {editingAccount?.has_transactions && (
                <p className="text-xs text-muted-foreground mt-1">
                  Não é possível editar o saldo atual quando há transações.
                </p>
              )}
            </div>

            {/* Cheque Especial */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_overdraft"
                  checked={formData.has_overdraft}
                  onChange={(e) => setFormData({ ...formData, has_overdraft: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="has_overdraft" className="text-sm font-medium">
                  Possui limite de cheque especial?
                </label>
              </div>
              {formData.has_overdraft && (
                <div className="space-y-2 pl-6">
                  <div>
                    <label className="text-sm font-medium">Limite de Cheque Especial (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.overdraft_limit}
                      onChange={(e) => setFormData({ ...formData, overdraft_limit: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Taxa de Juros Mensal (%)</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.overdraft_interest_rate}
                      onChange={(e) => {
                        // Allow comma or dot as decimal separator
                        const value = e.target.value.replace(/[^0-9.,]/g, '');
                        setFormData({ ...formData, overdraft_interest_rate: value });
                      }}
                      placeholder="5,50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      <i className='bx bx-info-circle mr-1'></i>
                      Taxa de juros aplicada sobre o saldo negativo. Use <strong>vírgula</strong> como separador decimal (ex: 5,5 para 5,5% ao mês).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Rendimento */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_yield"
                  checked={formData.has_yield}
                  onChange={(e) => setFormData({ ...formData, has_yield: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="has_yield" className="text-sm font-medium">
                  Conta possui rendimento
                </label>
              </div>
              {formData.has_yield && (
                <div className="pl-6 space-y-4">
                  {/* Tipo de Rendimento */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de Rendimento</label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="yield_type"
                          value="fixed"
                          checked={formData.yield_type === 'fixed'}
                          onChange={() => setFormData({ ...formData, yield_type: 'fixed' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Taxa Fixa Mensal</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="yield_type"
                          value="cdi_percentage"
                          checked={formData.yield_type === 'cdi_percentage'}
                          onChange={() => setFormData({ ...formData, yield_type: 'cdi_percentage' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">% do CDI</span>
                      </label>
                    </div>
                  </div>

                  {/* Taxa Fixa */}
                  {formData.yield_type === 'fixed' && (
                    <div>
                      <label className="text-sm font-medium">Taxa de Rendimento Mensal (%)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.yield_rate}
                        onChange={(e) => {
                          // Allow comma or dot as decimal separator
                          const value = e.target.value.replace(/[^0-9.,]/g, '');
                          setFormData({ ...formData, yield_rate: value });
                        }}
                        placeholder="0,50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        <i className='bx bx-info-circle mr-1'></i>
                        Taxa de rendimento aplicada sobre o saldo positivo. Use <strong>vírgula</strong> como separador decimal (ex: 0,5 para 0,5% ao mês).
                      </p>
                    </div>
                  )}

                  {/* % do CDI */}
                  {formData.yield_type === 'cdi_percentage' && (
                    <div>
                      <label className="text-sm font-medium">Percentual do CDI (%)</label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="500"
                        value={formData.cdi_percentage}
                        onChange={(e) => setFormData({ ...formData, cdi_percentage: e.target.value })}
                        placeholder="100"
                      />
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs">
                        <div className="flex items-start gap-2">
                          <i className='bx bx-info-circle text-primary mt-0.5'></i>
                          <div className="space-y-1">
                            <p>
                              Os bancos divulgam o rendimento como percentual do CDI. Exemplos:
                            </p>
                            <ul className="list-disc list-inside pl-2 space-y-0.5 text-muted-foreground">
                              <li><strong>100%</strong> do CDI = rende igual ao CDI</li>
                              <li><strong>102%</strong> do CDI = rende 2% a mais que o CDI</li>
                              <li><strong>120%</strong> do CDI = rende 20% a mais que o CDI</li>
                            </ul>
                            {loadingCdi ? (
                              <p className="text-muted-foreground mt-2">
                                <i className='bx bx-loader-alt bx-spin mr-1'></i>
                                Buscando taxa CDI atual...
                              </p>
                            ) : cdiRate ? (
                              <div className="mt-2 pt-2 border-t border-border">
                                <p className="font-medium text-foreground">Taxa CDI atual ({cdiRate.date}):</p>
                                <p className="text-muted-foreground">
                                  {cdiRate.daily_rate.toFixed(6)}% ao dia ≈ {cdiRate.monthly_rate.toFixed(2)}% ao mês ≈ {cdiRate.annual_rate.toFixed(2)}% ao ano
                                </p>
                                {formData.cdi_percentage && parseFloat(formData.cdi_percentage) > 0 && (
                                  <p className="text-primary font-medium mt-1">
                                    Com {formData.cdi_percentage}% do CDI: ≈ {(cdiRate.monthly_rate * parseFloat(formData.cdi_percentage) / 100).toFixed(2)}% ao mês
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingAccount ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a conta "{accountToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
