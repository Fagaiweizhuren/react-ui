"use strict"

import React from 'react'
import classnames from 'classnames'
import deepmerge from 'deepmerge'
import { isEmpty, forEach } from '../utils/objects'
import { nextUid, format, toArray } from '../utils/strings'
import Regs from '../utils/regs'
import { getLang } from '../lang'

let controls = {}

function getTip(key, value) {
  let text = getLang('validation.tips.' + key, null)
  if (text) {
    text = format(text, value)
  }
  return text
}

function getHint(hints, key, value) {
  let text = getLang('validation.hints.' + key, null)
  if (text) {
    hints.push(format(text, value))
  }
}

class FormControl extends React.Component {
  static displayName = 'FormControl'

  static propTypes = {
    children: React.PropTypes.any,
    className: React.PropTypes.string,
    data: React.PropTypes.any,
    hintType: React.PropTypes.oneOf(['block', 'none', 'pop', 'inline']),
    id: React.PropTypes.string,
    label: React.PropTypes.string,
    layout: React.PropTypes.oneOf(['aligned', 'stacked', 'inline']),
    name: React.PropTypes.string,
    onChange: React.PropTypes.func,
    responsive: React.PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
    style: React.PropTypes.object,
    type: React.PropTypes.string,
    value: React.PropTypes.any,
    width: React.PropTypes.number
  }

  static defaultProps = {
    id: nextUid(),
    layout: 'inline',
    responsive: 'md',
    type: 'text'
  }

  componentWillMount () {
    this.setHint(this.props)
  }

  componentWillReceiveProps (nextProps) {
    this.setHint(nextProps)
  }

  state = {
    focused: false,
    hasError: false,
    hasValue: this.props.value,
    value: this.props.value,
    valueType: controls[this.props.type].valueType,
    data: this.props.data,
    hintText: ''
  }

  setHint (props) {
    if (props.tip) {
      this.setState({ hintText: props.tip })
      return
    }

    let hints = []

    if (props.required) { getHint(hints, 'required') }
    getHint(hints, this.props.type)
    if (props.min) { getHint(hints, `min.${this.state.valueType}`, props.min) }
    if (props.max) { getHint(hints, `max.${this.state.valueType}`, props.max) }

    this.setState({ hintText: hints.join(', ') })
  }

  getReference () {
    return this.refs.control
  }

  validate (value) {
    value = value || this.getValue(null)

    this.setState({ hasValue: !isEmpty(value) })

    let {
      required,
      min,
      max,
      readOnly,
      type
    } = this.props

    if (readOnly) {
      return true
    }

    // validate require
    if (required && (value === undefined || value === null || value.length === 0)) {
      this.validateFail('required', value)
      return false
    }

    if (this.props.onValidate && !this.props.onValidate()) {
      this.validateFail('', value)
      return false
    }

    if (value === undefined || value === null || value === '') {
      this.validatePass()
      return true
    }

    // validate type
    let reg = Regs[type]
    if (reg && !reg.test(value)) {
      this.validateFail(type, value)
      return false
    }

    let len = 0
    let valueType = this.state.valueType

    switch(valueType) {
      case 'array':
        len = toArray(value, this.props.sep).length
      break
      case 'number':
        len = parseFloat(value)
      break
      default:
        len = value.length
      break
    }

    if (max && len > max) {
      this.validateFail(`max.${valueType}`, max)
      return false
    }

    if (min && len < min) {
      this.validateFail(`min.${valueType}`, min)
      return false
    }

    this.validatePass()
    return true
  }

  validatePass () {
    this.setState({ hasError: false, errorText: '' })
  }

  validateFail (type, value) {
    let text = getTip(type, value) || this.props.tip
    this.setState({ hasError: true, errorText: text })
  }

  handleChange (value) {
    this.validate(this.refs.control.getValue(null))
    if (this.props.onChange) {
      this.props.onChange(value)
    }
  }

  getValue (sep) {
    return this.refs.control.getValue(sep)
  }

  setValue (value) {
    if (this.refs.control.setValue) {
      this.refs.control.setValue(value)
    }
    this.validate(value)
  }

  handleFocus (focused) {
    this.setState({ focused })
  }

  copyProps () {
    let props = {}
    forEach(this.props, (v, k) => {
      props[k] = v
    })
    props.ref = 'control'
    props.value = this.state.value
    props.onChange = this.handleChange.bind(this)
    props.onFocus = this.handleFocus.bind(this, true)
    props.onBlur = this.handleFocus.bind(this, false)

    if (props.layout === 'inline') {
      props.placeholder = props.placeholder || props.label
    }

    // It's important use state.data instead of props.data
    // Otherwise control.data will be refreshed after setState
    props.data = this.state.data

    return props
  }

  getChildren (children, component) {
    if (!Array.isArray(children)) {
      children = [children]
    }
    let newChildren = []
    children.map((child, i) => {
      let props = { key: i }
      if (child.type === component) {
        props.ref = 'control'
      }
      if (child.props && typeof child.props.children === 'object') {
        props.children = this.getChildren(child.props.children, component)
      }
      child = React.addons.cloneWithProps(child, props)
      newChildren.push(child)
    })
    return newChildren
  }

  getControl (props) {
    let control = controls[this.props.type]
    if (!control) {
      console.warn(`${this.props.type} was not registed.`)
      return null
    }

    let children = this.props.children
    if (children) {
      return this.getChildren(children, control.component)
    } else {
      props = deepmerge(this.copyProps(), props || {})
      return control.render(props)
    }
  }

  renderInline (className) {
    if (this.props.width) {
      className = `${className} pure-u-1 pure-u-${this.props.responsive}-${this.props.width}-24`
    }
    return (
      <div style={this.props.style} className={className}>
        {this.getControl({ width: this.props.width ? 24 : undefined })}
        {
          this.state.errorText ?
          <span className="error">{this.state.errorText}</span> :
          ( this.state.hintText && <span className="hint">{this.state.hintText}</span> )
        }
      </div>
    )
  }

  renderStacked (className) {
    return (
      <div style={this.props.style} className={className}>
        <label className="label" htmlFor={this.props.id}>{this.props.label}</label>
        <div className="pure-control-inner">
          {this.getControl()}
          {
            this.state.errorText ?
            <span className="error">{this.state.errorText}</span> :
            ( this.state.hintText && <span className="hint">{this.state.hintText}</span> )
          }
        </div>
      </div>
    )
  }

  render () {
    let hintType = this.props.hintType ?
                   this.props.hintType :
                   ( this.props.layout === 'inline' ? 'pop' : 'block' )
    let className = classnames(
      this.props.className,
      'pure-control-group',
      `hint-${hintType}`,
      {
        'has-error': this.state.hasError,
        'focused': this.state.focused
      }
    )

    if (this.props.layout === 'inline') {
      return this.renderInline(className)
    } else {
      return this.renderStacked(className)
    }
  }
}

// register component
FormControl.register = function (types, render, component, valueType = 'string') {
  if (typeof types === 'string') {
    types = [types]
  }
  types.forEach(type => {
    controls[type] = { render, component, valueType }
  })
}

export default FormControl
