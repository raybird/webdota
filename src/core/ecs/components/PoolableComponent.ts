/**
 * PoolableComponent.ts - 可池化組件
 * 標記實體為可複用，並存儲其模板名稱
 */

import type { Component } from '../Component';
import { ComponentType } from '../Component';

export class PoolableComponent implements Component {
    readonly type = ComponentType.POOLABLE;
    public readonly templateName: string;

    constructor(
        /** 模板名稱 (如 'creep_red', 'creep_blue') */
        templateName: string
    ) {
        this.templateName = templateName;
    }
}
