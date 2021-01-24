实现数据绑定的几种方式
1. 发布者订阅者模式
2. 脏值检测 angular.js就是使用这种方式，对比数据是否变更从而来更新UI
3. 数据劫持 vue就是使用的是数据劫持 结合 发布者-订阅者模式，通过Object.defineProperty()来劫持各个属性的getter和setter，在数据变动时发布消息给订阅者，触发相关的监听回调。

1. 实现指令解析器compile

MVVM响应式原理

Vue 采用数据劫持和发布者-订阅者模式的方式，通过Object.defineProperty()方法来劫持各个属性的setter和getter，在数据变动时，发布消息给Dep（依赖收集器），去通知Watcher（观察者）做出对应的回调函数，去更新视图。


