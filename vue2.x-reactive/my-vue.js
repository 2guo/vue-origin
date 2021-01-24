/**
 * 入口
 */
class MyVue {
  constructor(options) {
    this.$el = options.el
    this.$data = options.data
    this.$options = options
    if (this.$el) {
      // 实现数据观察者
      new Observer(this.$data)
      // 实现指令解析器
      new Complie(this.$el, this)
      // 添加代理
      this.proxyData(this.$data)
    }
  }
  proxyData(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newVal) {
          data[key] = newVal
        },
      })
    }
  }
}

/**
 * 编译类
 */
class Complie {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    // 获取文档碎片对象，放入内存中会减少页面的回流和重绘
    const fragment = this.node2Fragment(this.el)
    // 编译模板
    this.complie(fragment)
    // 追加子元素到根元素
    this.el.appendChild(fragment)
  }
  node2Fragment(node) {
    const f = document.createDocumentFragment() // 创建文档碎片
    let firstChild
    while ((firstChild = node.firstChild)) {
      f.appendChild(firstChild)
    }
    return f
  }
  complie(fragment) {
    const childNodes = fragment.childNodes
    ;[...childNodes].forEach((child) => {
      if (this.isElementNode(child)) {
        this.compileElement(child)
      } else {
        this.compileText(child)
      }
      // 递归遍历子节点
      if (child.childNodes && child.childNodes.length) {
        this.complie(child)
      }
    })
  }
  compileElement(node) {
    const attributes = node.attributes
    ;[...attributes].forEach((attr) => {
      // attr值为： v-text="message" v-html="htmlStr" type="text"……
      const { name, value } = attr // name: v-text，value: message
      if (this.isCommonDirective(name)) {
        const [, dirctive] = name.split('-') // text html model on:click
        const [dirctiveName, eventName] = dirctive.split(':') // dirctiveName: text html model on, eventName: click
        compileUtil[dirctiveName](node, value, this.vm, eventName) // 更新数据 数据驱动视图
        node.removeAttribute('v-' + dirctive)
      } else if (this.isAtDirective(name)) {
        // @click=handleClick
        const [, eventName] = name.split('@')
        compileUtil['on'](node, value, this.vm, eventName)
      } else if (this.isColonDirective(name)) {
        // :src="xxx"
        const [, attrName] = name.split(':')
        compileUtil['bind'](node, value, this.vm, attrName)
        node.removeAttribute(':' + attrName)
      }
    })
  }
  compileText(node) {
    //  {{}}
    const content = node.textContent
    if (/\{\{(.+?)\}\}/.test(content)) {
      compileUtil['text'](node, content, this.vm)
    }
  }
  isElementNode(node) {
    return node.nodeType === 1
  }
  isCommonDirective(attrName) {
    return attrName.startsWith('v-')
  }
  isAtDirective(attrName) {
    return attrName.startsWith('@')
  }
  isColonDirective(attrName) {
    return attrName.startsWith(':')
  }
}

const compileUtil = {
  getValue(expr, vm) {
    // person.name
    return expr.split('.').reduce((pre, cur) => {
      return pre[cur]
    }, vm.$data)
  },
  setValue(expr, vm, value) {
    return expr.split('.').reduce((data, currentVal, index, arr) => {
      if (arr[index] == arr[arr.length - 1]) {
        data[currentVal] = value
      }
      return data[currentVal]
    }, vm.$data)
  },
  getContentVal(expr, vm) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getValue(args[1].trim(), vm)
    })
  },
  text(node, expr, vm) {
    let value
    if (expr.indexOf('{{') !== -1) {
      // {{ person.age }} -> person.age 注意前后空格
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1].trim(), (newVal) => {
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getValue(args[1].trim(), vm)
      })
    } else {
      value = this.getValue(expr, vm)
    }
    this.updater.textUpdater(node, value)
  },
  html(node, expr, vm) {
    const value = this.getValue(expr, vm)
    new Watcher(vm, expr, (newVal) => {
      this.updater.htmlUpdater(node, newVal)
    })
    this.updater.htmlUpdater(node, value)
  },
  model(node, expr, vm) {
    const value = this.getValue(expr, vm)
    // 绑定更新函数 数据驱动视图
    new Watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal)
    })
    // 视图 -> 数据 -> 视图
    node.addEventListener('input', (e) => {
      this.setValue(expr, vm, e.target.value)
    })

    this.updater.modelUpdater(node, value)
  },
  on(node, expr, vm, eventName) {
    const fn = vm.$options.methods && vm.$options.methods[expr]
    node.addEventListener(eventName, fn.bind(vm), false)
  },
  bind(node, expr, vm, attrName) {
    const attrValue = vm.$data[expr]
    node.setAttribute(attrName, attrValue)
  },
  updater: {
    textUpdater(node, value) {
      node.textContent = value
    },
    htmlUpdater(node, value) {
      node.innerHTML = value
    },
    modelUpdater(node, value) {
      node.value = value
    },
  },
}

/**
 * 数据监听器
 */
class Observer {
  constructor(data) {
    this.observer(data)
  }
  observer(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        this.defineReactive(data, key, data[key])
      })
    }
  }
  defineReactive(data, key, value) {
    const _this = this
    _this.observer(value)
    const dep = new Dep()
    // 劫持并监听所有属性
    Object.defineProperty(data, key, {
      enumerable: true,
      configurable: false,
      get() {
        // 订阅数据变化时，往Dep中添加观察者
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set(newVal) {
        _this.observer(newVal)
        if (newVal !== value) {
          value = newVal
        }
        dep.notify() // 告诉dep通知变化
      },
    })
  }
}

/**
 * 依赖收集器
 */
class Dep {
  constructor() {
    this.subs = []
  }
  // 添加观察者
  addSub(watcher) {
    this.subs.push(watcher)
  }
  // 通知观察者
  notify() {
    console.log('观察者', this.subs)
    this.subs.forEach((w) => w.update())
  }
}

class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    this.oldVal = this.getOldVal() // 先把旧值保存起来
  }
  getOldVal() {
    Dep.target = this
    const oldVal = compileUtil.getValue(this.expr, this.vm)
    Dep.target = null
    return oldVal
  }
  update() {
    const newVal = compileUtil.getValue(this.expr, this.vm)
    if (newVal !== this.oldVal) {
      this.cb(newVal)
    }
  }
}
